'use strict';
const CLOUD_WORKER_URL = 'https://ingo-checko-api.tikhonovaa38.workers.dev';
const financialFields = {revenue:'Revenue',profit:'Profit',equity:'Equity',netAssets:'NetAssets',debt:'Debt'};
const lookupState = Object.fromEntries(['client','debtor'].map(p=>[p,{generation:0,controller:null,timer:null,loaded:'',inn:$(p+'Inn').value.trim()}]));
function scalar(v){return typeof v==='string'||typeof v==='number'?String(v):''}
function numeric(v){if(typeof v==='number')return Number.isFinite(v)?v:null;if(typeof v==='string'&&/^-?\d+(\.\d+)?$/.test(v.trim()))return Number(v);return null}
function normalizeChecko(body, inn, units){
 const company=body.results?.[inn.length===12?'entrepreneur':'company'];
 const d=company?.ok&&company.data&&typeof company.data==='object'?company.data:null;
 const obj={inn},notes=[];
 if(d){
  if(!d.ИНН||String(d.ИНН)!==inn)throw Error('ИНН в ответе Чекко отсутствует или не совпадает с запросом');
  obj.name=scalar(d.НаимСокр)||scalar(d.НаимПолн)||scalar(d.ФИО);
  const region=scalar(d.Регион?.Наим)||scalar(d.Регион)||scalar(d.ЮрАдрес?.Регион?.Наим)||scalar(d.ЮрАдрес?.Регион);
  if(region)obj.region=region;
  obj.industry=[scalar(d.ОКВЭД?.Код),scalar(d.ОКВЭД?.Наим)||scalar(d.ОКВЭД?.Наи)||scalar(d.ОКВЭД)].filter(Boolean).join(' · ');
 }else notes.push('Реквизиты не получены');
 const fin=body.results?.finances;
 if(fin?.ok&&d&&inn.length===10){
  if(units!=='rub'&&units!=='thousand')notes.push('Финансы получены; подтвердите единицы ответа API');
  else {
   const years=Object.keys(fin.data||{}).filter(y=>/^20\d{2}$/.test(y)&&Number(y)<new Date().getFullYear()).sort().reverse();
   const year=years[0], rows=fin.data?.[year];
   if(rows&&typeof rows==='object'){
    const divisor=units==='rub'?1e6:1e3;
    const line=code=>numeric(typeof rows[code]==='object'&&rows[code]!==null?rows[code].СумОтч:rows[code]);
    for(const [key,code] of Object.entries({revenue:'2110',profit:'2400',equity:'1300',netAssets:'3600'})){const value=line(code);if(value!==null)obj[key]=value/divisor}
    const long=line('1400'),short=line('1500');if(long!==null&&short!==null)obj.debt=(long+short)/divisor;
    obj.year=year;notes.push('Отчётность за '+year+' год; '+(units==='rub'?'рубли':'тыс. рублей')+' → млн ₽');
   }else notes.push('Структура финансов не распознана; показатели оставлены пустыми');
  }
 }else notes.push(inn.length===12?'Для ИП бухгалтерская отчётность не запрашивается':'Финансовая отчётность недоступна');
 for(const [method,label] of [['legal-cases','Арбитраж'],['enforcements','ФССП']]){
  const r=body.results?.[method];notes.push(label+': '+(r?.ok?'ответ получен, требуется проверка аналитиком':'сведения не получены'));
 }
 // An unfiltered or paginated list cannot prove absence of claims against the company.
 return {obj,notes,companyOk:!!d};
}
function resetConclusion(){last='';$('status').className='status';$('status').textContent='Данные изменились — сформируйте заключение заново';$('mData').textContent='—';$('mLimit').textContent='—';$('factors').textContent='Ожидается повторная оценка.';$('rationale').textContent='Используйте актуальные сведения обеих сторон.'}
function clearParty(p){for(const suffix of ['Name','Region','Industry',...Object.values(financialFields),'Claims','Year'])$(p+suffix).value='';$(p+'Court').value='unknown';const marker=(p==='client'?'Клиент':'Дебитор')+': Чекко API;';$('sources').value=$('sources').value.split('\n').filter(x=>!x.startsWith(marker)).join('\n');resetConclusion()}
function queueLookup(p){const state=lookupState[p];clearTimeout(state.timer);state.controller?.abort();state.generation++;const inn=$(p+'Inn').value.trim();
 if(inn!==state.inn){clearParty(p);state.loaded='';state.inn=inn}
 $(p+'CheckoStatus').textContent=!inn?'Введите ИНН.':!validInn(inn)?'ИНН не проходит контрольную проверку.':!$('spprAccessToken').value.trim()?'Введите код доступа СППР.':'Ожидается загрузка…';
 if(validInn(inn)&&$('spprAccessToken').value.trim())state.timer=setTimeout(()=>loadParty(p),800);
}
async function loadParty(p,force=false){
 const state=lookupState[p],inn=$(p+'Inn').value.trim(),access=$('spprAccessToken').value.trim(),units=$('checkoUnits').value;
 if(!validInn(inn)||!access){queueLookup(p);return}
 const signature=inn+'|'+units;if(!force&&state.loaded===signature){$(p+'CheckoStatus').textContent='Сведения уже загружены. Для обновления нажмите кнопку.';return}
 clearTimeout(state.timer);state.controller?.abort();const controller=new AbortController();state.controller=controller;const generation=++state.generation;
 clearParty(p);state.loaded='';
 $(p+'CheckoStatus').textContent='Запрашиваем сведения Чекко…';
 const timeout=setTimeout(()=>controller.abort(),30000);
 try{
  const url=new URL(CLOUD_WORKER_URL+'/api/checko');url.searchParams.set('inn',inn);
  url.searchParams.set('methods',inn.length===12?'entrepreneur,legal-cases,enforcements':'company,finances,legal-cases,enforcements');
  const response=await fetch(url,{headers:{Authorization:'Bearer '+access,Accept:'application/json'},signal:controller.signal,cache:'no-store'});
  if(!response.ok)throw Error(response.status===401||response.status===403?'Нет доступа. Проверьте код СППР и адрес страницы.':response.status===429?'Лимит обращений исчерпан. Повторите позже.':'Сервер вернул ошибку '+response.status);
  const body=await response.json();const {obj,notes,companyOk}=normalizeChecko(body,inn,units);
  if(generation!==state.generation||$(p+'Inn').value.trim()!==inn)return;
  if(!companyOk)throw Error(notes.join('. '));
  clearParty(p);
  if(obj.region&&!Array.from($(p+'Region').options).some(o=>o.value===obj.region))$(p+'Region').add(new Option(obj.region,obj.region));
  applyImport(p,obj);if(obj.year)$(p+'Year').value=obj.year;
  const retrieved=Number.isNaN(Date.parse(body.retrievedAt))?new Date().toISOString():body.retrievedAt;
  $('sources').value+=($('sources').value?'\n':'')+(p==='client'?'Клиент':'Дебитор')+': Чекко API; '+retrieved+'; ИНН '+inn+(obj.year?'; отчётность '+obj.year:'')+'; https://checko.ru/';
  state.loaded=signature;$(p+'CheckoStatus').textContent='Реквизиты загружены. '+notes.join('. ')+'.';
  $('autoLog').textContent='Сведения загружены. Проверьте показатели и сформируйте заключение.';
 }catch(error){if(generation!==state.generation)return;$(p+'CheckoStatus').textContent=error.name==='AbortError'?'Время ожидания истекло. Повторите загрузку.':error instanceof TypeError?'Не удалось связаться с сервером. Откройте СППР на настроенном адресе GitHub Pages.':error.message;
 }finally{clearTimeout(timeout);if(state.controller===controller)state.controller=null}
}
for(const p of ['client','debtor'])$(p+'Inn').addEventListener('input',()=>queueLookup(p));
for(const id of ['spprAccessToken','checkoUnits'])$(id).addEventListener('change',()=>{for(const p of ['client','debtor']){lookupState[p].loaded='';clearParty(p);queueLookup(p)}});
$('fetchCompanies').onclick=async()=>{const b=$('fetchCompanies');b.disabled=true;try{await Promise.all(['client','debtor'].map(p=>loadParty(p,true)))}finally{b.disabled=false}};
// Keep the reporting dates of the parties in the downloadable conclusion.
const originalAssess=assess;
assess=function(){originalAssess();last+='\nГод отчётности клиента: '+($('clientYear').value||'не указан')+'\nГод отчётности дебитора: '+($('debtorYear').value||'не указан')};
$('run').onclick=assess;

for(const p of ['client','debtor'])$(p+'Import').addEventListener('change',()=>{const s=lookupState[p];clearTimeout(s.timer);s.controller?.abort();s.generation++;s.loaded='';clearParty(p);$(p+'CheckoStatus').textContent='Используется локальный импорт.'},true);
for(const p of ['client','debtor'])for(const suffix of ['Name','Region','Industry',...Object.values(financialFields),'Claims','Court'])$(p+suffix).addEventListener('input',resetConclusion);
