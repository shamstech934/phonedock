import { Phone, Video, YouTubeIntelligenceSignal } from '@/lib/models';

const normalize=(v:string)=>v.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
function category(title:string){ const t=title.toLowerCase(); if(/\bvs\b|comparison|compare/.test(t)) return 'comparison'; if(/unboxing|first look|hands on/.test(t)) return 'unboxing'; if(/shorts?|#shorts/.test(t)) return 'shorts'; if(/review|tested|test/.test(t)) return 'review'; if(/tutorial|how to|guide/.test(t)) return 'tutorial'; return 'news'; }
export async function scanYouTubeIntelligence({ limit=150 }:{limit?:number}={}){
  const safeLimit=Math.min(300,Math.max(1,limit));
  const videos:any[]=await Video.find({ status:{ $in:['pending','draft'] } }).sort({ publishedAt:-1 }).limit(safeLimit).lean();
  const phones:any[]=await Phone.find({ active:true, status:'published', deletedAt:null }).select('_id modelName').lean();
  let scanned=0,opened=0,matched=0;
  for(const video of videos){ scanned++; const titleNorm=normalize(video.title||''); const candidates=phones.filter(p=>{ const n=normalize(p.modelName||''); return n.length>=4 && titleNorm.includes(n); }).sort((a,b)=>String(b.modelName).length-String(a.modelName).length);
    const match=candidates.length===1?candidates[0]:(candidates.length>1 && String(candidates[0].modelName).length>String(candidates[1].modelName).length*1.25?candidates[0]:null);
    const recCategory=category(video.title||'');
    const types:string[]=[]; if(!video.phoneId)types.push('missing_phone_link'); if(!video.category||video.category!==recCategory)types.push('category_suggestion');
    if(!types.length){ await YouTubeIntelligenceSignal.updateMany({videoId:video._id,status:'open'},{$set:{status:'resolved',resolvedAt:new Date(),resolutionNotes:'Video metadata is complete.'}}); continue; }
    if(match)matched++;
    for(const type of types){ await YouTubeIntelligenceSignal.findOneAndUpdate({videoId:video._id,type},{ $set:{ status:'open',severity:type==='missing_phone_link'?'warning':'info',recommendedPhoneId:match?match._id:null,recommendedCategory:recCategory,confidence:match?90:45,details:match?`Suggested ${match.modelName} and ${recCategory}.`:`Suggested category ${recCategory}; phone match needs review.`,evidence:{title:video.title,candidateCount:candidates.length},lastSeenAt:new Date()},$setOnInsert:{detectedAt:new Date()}},{upsert:true,new:true}); opened++; }
  }
  return {scanned,opened,matched,limit:safeLimit};
}
