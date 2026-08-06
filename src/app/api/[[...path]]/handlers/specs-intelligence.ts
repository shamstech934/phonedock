import { NextRequest, NextResponse } from 'next/server';
import { ActivityLog, Phone, PhoneSpecs, SpecsIntelligenceSignal } from '@/lib/models';
import { connectDB, getAdminFromRequest, requirePermission } from './helpers';
import { scanSpecsIntelligence } from '@/lib/specs-intelligence';
import { revalidatePublicContent } from '@/lib/revalidate';

export async function handleSpecsIntelligenceGet(req: NextRequest): Promise<NextResponse> {
  const auth=await getAdminFromRequest(req); if(auth.error)return auth.error;
  const denied=requirePermission(auth.admin,'phones:read'); if(denied)return denied; await connectDB();
  const status=req.nextUrl.searchParams.get('status')||'open'; const field=req.nextUrl.searchParams.get('field')||'all';
  const page=Math.max(1,Number(req.nextUrl.searchParams.get('page')||1)); const limit=Math.min(100,Math.max(10,Number(req.nextUrl.searchParams.get('limit')||30)));
  const filter:any={}; if(status!=='all')filter.status=status; if(field!=='all')filter.field=field;
  const [items,total,open,critical,withRecommendation]=await Promise.all([
    SpecsIntelligenceSignal.find(filter).sort({severity:1,lastSeenAt:-1}).skip((page-1)*limit).limit(limit).populate({path:'phoneId',select:'modelName slug status brandId',populate:{path:'brandId',select:'name'}}).lean(),
    SpecsIntelligenceSignal.countDocuments(filter), SpecsIntelligenceSignal.countDocuments({status:'open'}), SpecsIntelligenceSignal.countDocuments({status:'open',severity:'critical'}), SpecsIntelligenceSignal.countDocuments({status:'open',recommendedValue:{$ne:''}}),
  ]);
  return NextResponse.json({items,total,page,pages:Math.max(1,Math.ceil(total/limit)),summary:{open,critical,withRecommendation}},{headers:{'Cache-Control':'no-store'}});
}
export async function handleSpecsIntelligencePost(req: NextRequest): Promise<NextResponse> {
  const auth=await getAdminFromRequest(req); if(auth.error)return auth.error;
  const denied=requirePermission(auth.admin,'phones:edit'); if(denied)return denied; await connectDB();
  const body=await req.json().catch(()=>({})); const action=String(body.action||'');
  if(action==='scan'){const result=await scanSpecsIntelligence({limit:Number(body.limit||200)});await ActivityLog.create({adminId:auth.admin._id,action:'specs_intelligence_scan',entityType:'specs_intelligence',details:JSON.stringify(result)});return NextResponse.json({success:true,...result});}
  const id=String(body.id||''); if(!id)return NextResponse.json({error:'Signal id is required'},{status:400});
  const signal:any=await SpecsIntelligenceSignal.findById(id); if(!signal)return NextResponse.json({error:'Signal not found'},{status:404});
  if(action==='dismiss'){signal.status='dismissed';signal.resolvedAt=new Date();signal.resolvedBy=auth.admin._id;signal.resolutionNotes=String(body.notes||'Dismissed by admin.');await signal.save();return NextResponse.json({success:true,signal});}
  if(action!=='apply')return NextResponse.json({error:'Unsupported action'},{status:400});
  if(!signal.recommendedValue)return NextResponse.json({error:'No verified recommendation is available for this field'},{status:400});
  const phone:any=await Phone.findById(signal.phoneId); if(!phone)return NextResponse.json({error:'Linked phone not found'},{status:404});
  const specs:any=await PhoneSpecs.findOneAndUpdate({phoneId:phone._id},{$setOnInsert:{phoneId:phone._id}},{upsert:true,new:true});
  if(String(specs[signal.field]||'').trim()&&!body.force)return NextResponse.json({error:'Field already contains a value. Use force only after manual comparison.'},{status:409});
  specs.set(signal.field,String(signal.recommendedValue)); await specs.save();
  phone.lastVerifiedAt=new Date(); if(signal.confidence>=90)phone.dataConfidence='verified'; await phone.save();
  signal.status='resolved';signal.resolvedAt=new Date();signal.resolvedBy=auth.admin._id;signal.resolutionNotes=String(body.notes||'Verified recommendation applied by admin.');await signal.save();
  await ActivityLog.create({adminId:auth.admin._id,action:'specs_intelligence_applied',entityType:'phone',entityId:phone._id,details:`${signal.field}: ${phone.modelName} (${signal.sourceName||'reviewed source'})`}); revalidatePublicContent();
  return NextResponse.json({success:true,signal});
}
