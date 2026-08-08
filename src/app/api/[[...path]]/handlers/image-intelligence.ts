import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, ImageIntelligenceSignal, Phone, PhoneImage } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { scanImageIntelligence, verifyRemoteImageUrls } from '@/lib/image-intelligence';
import { revalidatePublicContent } from '@/lib/revalidate';

export async function handleImageIntelligenceGet(req: NextRequest): Promise<NextResponse> {
  const auth=await getAdminFromRequest(req); if(auth.error)return auth.error;
  const denied=requirePermission(auth.admin,'phones:read'); if(denied)return denied; await connectDB();
  const status=req.nextUrl.searchParams.get('status')||'open'; const type=req.nextUrl.searchParams.get('type')||'all'; const phoneId=req.nextUrl.searchParams.get('phoneId')||'';
  const page=Math.max(1,Number(req.nextUrl.searchParams.get('page')||1)); const limit=Math.min(100,Math.max(10,Number(req.nextUrl.searchParams.get('limit')||50)));
  const filter:Record<string,unknown>={}; if(status!=='all')filter.status=status;if(type!=='all')filter.type=type;if(phoneId)filter.phoneId=phoneId;
  const [items,total,openSignals,phonesWithoutImages,missingAlt,duplicates,identityRisks,brokenRemote]=await Promise.all([
    ImageIntelligenceSignal.find(filter).sort({severity:1,lastSeenAt:-1}).skip((page-1)*limit).limit(limit)
      .populate('phoneId','modelName slug status thumbnail')
      .populate('imageId','url altText sortOrder role color verified sourceName sourceUrl').lean(),
    ImageIntelligenceSignal.countDocuments(filter),
    ImageIntelligenceSignal.countDocuments({status:'open'}),
    ImageIntelligenceSignal.countDocuments({status:'open',type:'missing_all_images'}),
    ImageIntelligenceSignal.countDocuments({status:'open',type:'missing_alt_text'}),
    ImageIntelligenceSignal.countDocuments({status:'open',type:'duplicate_image'}),
    ImageIntelligenceSignal.countDocuments({status:'open',type:{$in:['cross_phone_duplicate','multiple_primary_images']}}),
    ImageIntelligenceSignal.countDocuments({status:'open',type:'broken_remote_url'}),
  ]);
  return NextResponse.json({items,total,page,pages:Math.max(1,Math.ceil(total/limit)),summary:{openSignals,phonesWithoutImages,missingAlt,duplicates,identityRisks,brokenRemote}},{headers:{'Cache-Control':'no-store'}});
}

export async function handleImageIntelligencePost(req: NextRequest): Promise<NextResponse> {
  const auth=await getAdminFromRequest(req); if(auth.error)return auth.error;
  const denied=requirePermission(auth.admin,'phones:edit'); if(denied)return denied; await connectDB();
  const body=await req.json().catch(()=>({})); const action=String(body.action||'');
  if(action==='scan'){const result=await scanImageIntelligence({limit:Number(body.limit||500)});await ActivityLog.create({adminId:auth.admin._id,action:'image_intelligence_scan',entityType:'image_intelligence',details:JSON.stringify(result)});return NextResponse.json({success:true,...result});}
  if(action==='verify_remote'){const result=await verifyRemoteImageUrls({limit:Number(body.limit||20)});await ActivityLog.create({adminId:auth.admin._id,action:'image_intelligence_remote_check',entityType:'image_intelligence',details:JSON.stringify(result)});return NextResponse.json({success:true,...result});}
  if(action==='bulk_dismiss'){
    const ids=Array.isArray(body.ids)?body.ids.map(String).slice(0,100):[]; if(!ids.length)return NextResponse.json({error:'Select at least one image issue'},{status:400});
    const result=await ImageIntelligenceSignal.updateMany({_id:{$in:ids},status:'open'},{$set:{status:'dismissed',resolvedAt:new Date(),resolvedBy:auth.admin._id,resolutionNotes:'Bulk dismissed by admin.'}});
    await ActivityLog.create({adminId:auth.admin._id,action:'image_intelligence_bulk_dismiss',entityType:'image_intelligence',details:`Dismissed ${result.modifiedCount} image issues`});
    return NextResponse.json({success:true,updated:result.modifiedCount});
  }
  const id=String(body.id||''); if(!id)return NextResponse.json({error:'Signal id is required'},{status:400});
  const signal:any=await ImageIntelligenceSignal.findById(id); if(!signal)return NextResponse.json({error:'Signal not found'},{status:404});
  if(signal.status!=='open')return NextResponse.json({error:`Signal is already ${signal.status}`},{status:409});
  if(action==='dismiss'){signal.status='dismissed';signal.resolvedAt=new Date();signal.resolvedBy=auth.admin._id;signal.resolutionNotes=String(body.notes||'Dismissed by admin.');await signal.save();return NextResponse.json({success:true,signal});}
  if(action!=='apply')return NextResponse.json({error:'Unsupported action'},{status:400});
  const phone:any=await Phone.findById(signal.phoneId); if(!phone)return NextResponse.json({error:'Linked phone not found'},{status:404});
  const image:any=signal.imageId?await PhoneImage.findById(signal.imageId):null;
  switch(signal.type){
    case 'missing_thumbnail': case 'insecure_thumbnail': {
      const value=String(signal.recommendedValue||'').trim(); if(!value)return NextResponse.json({error:'No safe thumbnail recommendation is available'},{status:400}); phone.thumbnail=value;await phone.save();break;
    }
    case 'missing_alt_text': {
      if(!image)return NextResponse.json({error:'Linked image not found'},{status:404}); const value=String(signal.recommendedValue||'').trim();if(!value)return NextResponse.json({error:'No alt-text recommendation is available'},{status:400});image.altText=value;await image.save();break;
    }
    case 'insecure_image_url': {
      if(!image)return NextResponse.json({error:'Linked image not found'},{status:404});const value=String(signal.recommendedValue||'').trim();if(!value)return NextResponse.json({error:'No HTTPS recommendation is available'},{status:400});image.url=value;await image.save();break;
    }
    case 'duplicate_image': case 'invalid_image_url': {
      if(!image)return NextResponse.json({error:'Linked image not found'},{status:404});await PhoneImage.deleteOne({_id:image._id});break;
    }
    case 'thumbnail_not_in_gallery': {
      const value=String(signal.recommendedValue||phone.thumbnail||'').trim();if(!value)return NextResponse.json({error:'No thumbnail URL is available'},{status:400});
      const exists=await PhoneImage.exists({phoneId:phone._id,url:value,status:{$ne:'rejected'}});if(!exists)await PhoneImage.create({phoneId:phone._id,url:value,altText:`${phone.modelName} official image`,sortOrder:0,role:'thumbnail',verified:false,sourceName:'Phone thumbnail'});break;
    }
    case 'multiple_primary_images': {
      const images:any[]=await PhoneImage.find({phoneId:phone._id,status:{$ne:'rejected'}}).sort({verified:-1,sortOrder:1,createdAt:1});
      if(!images.length)return NextResponse.json({error:'No gallery images are available'},{status:409});
      const thumbnail=String(phone.thumbnail||'').trim();const keeper=images.find(i=>thumbnail&&String(i.url)===thumbnail)||images.find(i=>i.verified)||images[0];
      await PhoneImage.updateMany({phoneId:phone._id,role:'thumbnail',_id:{$ne:keeper._id}},{$set:{role:'gallery'}});keeper.role='thumbnail';await keeper.save();if(!phone.thumbnail){phone.thumbnail=keeper.url;await phone.save();}break;
    }
    case 'gallery_order_collision': {
      const images:any[]=await PhoneImage.find({phoneId:phone._id,status:{$ne:'rejected'}}).sort({sortOrder:1,createdAt:1});
      for(let i=0;i<images.length;i++){if(Number(images[i].sortOrder)!==i){images[i].sortOrder=i;await images[i].save();}}break;
    }
    default:return NextResponse.json({error:'This image issue is review-only. Verify the source in the phone editor before changing data.'},{status:400});
  }
  signal.status='resolved';signal.resolvedAt=new Date();signal.resolvedBy=auth.admin._id;signal.resolutionNotes=String(body.notes||'Image correction applied after admin review.');await signal.save();
  await ActivityLog.create({adminId:auth.admin._id,action:'image_intelligence_applied',entityType:'phone',entityId:phone._id,details:`${signal.type}: ${phone.modelName}`});revalidatePublicContent();
  return NextResponse.json({success:true,signal});
}
