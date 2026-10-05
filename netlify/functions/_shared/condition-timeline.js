const CONDITION_FIELD='01i2ggTacsfSrYfKqLxq',TIMELINE_FIELD='Dwz4ZW2U43Psb6h6nDs3';
const conditions=new Set(['Move-In Ready','Needs Work','Heavily Distressed','Vacant / Abandoned']);
const timelines=new Set(['ASAP','30 Days','60-90 Days','Just Exploring']);
export function conditionTimelinePatch(body){
 const fields=[];const authoritative=body.stage==='qualified'||String(body.page||'').includes('step3-complete');
 for(const [key,id,allowed] of [['property_condition',CONDITION_FIELD,conditions],['selling_timeline',TIMELINE_FIELD,timelines]]){
  const raw=body[key];if(raw==null||typeof raw==='string'&&!raw.trim())continue;
  if(!authoritative)throw Error('final_details_required');
  if(typeof raw!=='string'||!allowed.has(raw.trim()))throw Error('invalid_'+key);
  fields.push({id,fieldValue:raw.trim()});
 }
 return fields;
}
