(function(root){
'use strict';
const yes=v=>v==='yes'?true:v==='no'?false:null;
const known=(v,label)=>({state:v, label});
const number=(v)=>v===''||v===null||v===undefined?null:Number.isFinite(Number(v))?Number(v):null;
const atLeast=(v,n)=>number(v)===null?null:number(v)>=n;
const atMost=(v,n)=>number(v)===null?null:number(v)>=0&&number(v)<=n;
const either=(a,b)=>a===true||b===true?true:a===null||b===null?null:false;
function priority(p){
 const pay=known(p.payGroup==='u'||!p.payGroup?null:['1','2'].includes(p.payGroup),'группа платёжеспособности 1 или 2');
 const independent=known(yes(p.independence),'высокая финансовая независимость');
 const stable=known(yes(p.stability),'устойчивый финансовый профиль');
 const band=p.externalRating||'u';
 const paths=[
  {tier:1,name:'1.1а · Федеральная розничная сеть',rules:[known(yes(p.federalRetail),'статус федеральной розничной сети'),pay,known(atMost(p.overdueDays,15),'средневзвешенная просрочка не более 15 дней')]},
  {tier:1,name:'1.1б · Рейтинг не ниже A−',rules:[known(band==='u'?null:band==='a','рейтинг организации или группы не ниже A−, применимость подтверждена'),pay]},
  {tier:1,name:'1.1в · Хорошее финансовое положение',rules:[known(!p.fp||p.fp==='u'?null:p.fp==='good','оценка финансового положения «хорошее»'),pay,independent,stable]},
  {tier:2,name:'1.2а · Выручка от 1 млрд ₽',rules:[known(atLeast(p.revenue,1000),'годовая выручка от 1 млрд ₽'),independent,stable,known(!p.fp||p.fp==='u'?null:['good','medium'].includes(p.fp),'финансовое положение не хуже среднего'),pay]},
  {tier:2,name:'1.2б · Средний бизнес с рейтингом',rules:[known(yes(p.middleBusiness),'принадлежность к среднему бизнесу'),known(either(!p.bankRating||p.bankRating==='u'?null:/^P[1-9]$/.test(p.bankRating),band==='u'?null:['a','b'].includes(band)),'внутренний рейтинг P1–P9 или внешний не ниже B'),known(yes(p.positiveHistory),'положительная кредитная история'),independent,stable]}
 ];
 const matched=paths.filter(x=>x.rules.every(r=>r.state===true));
 const tier=matched.length?Math.min(...matched.map(x=>x.tier)):null;
 const possible=paths.filter(x=>!x.rules.some(r=>r.state===false));
 return {tier,paths,matched:matched.filter(x=>x.tier===tier).map(x=>x.name),pending:possible.map(x=>({name:x.name,missing:x.rules.filter(r=>r.state===null).map(r=>r.label)})),outside:!tier&&!possible.length};
}
function evaluate(input){
 const stops=[],deviations=[],unknown=[],positive=[],checks=[];
 const add=(state,label)=>{checks.push({state,label});if(state==='missing')unknown.push(label);else if(state==='deviation')deviations.push(label);else if(state==='pass')positive.push(label);else if(state==='stop')stops.push(label)};
 const check=(value,label,fail)=>add(value===null?'missing':value?'pass':'deviation',value===false?fail:label);
 if(input.delivery==='pre')add('stop','Пункт 4: предпоставочный факторинг запрещён');else if(input.delivery==='post')add('pass','Поставка уже состоялась: запрет предпоставочного факторинга не выявлен');else add('missing','Подтвердите, что финансирование не является предпоставочным');
 const limit=number(input.limit);if(limit===null||limit<=0)add('missing','Укажите положительный запрашиваемый лимит');
 check(atMost(input.delay,180),'Отсрочка не более 180 дней','Отсрочка превышает 180 дней');
 if(number(input.delay)!==null&&number(input.delay)<0)add('missing','Отсрочка не может быть отрицательной');
 check(atLeast(input.experienceMonths,6),'Опыт работы поставщика с дебитором не менее 6 месяцев','Опыт работы поставщика с дебитором менее 6 месяцев');
 const volume=number(input.relationshipVolume);
 if(!input.volumeBasis?.trim())add('missing','Укажите период и источник подтверждения объёма работы поставщика с дебитором');
 if(limit!==null&&limit>0){const lo=limit*.8,hi=limit*1.2;check(volume===null?null:volume>=lo&&volume<=hi,'Объём работы сопоставим с лимитом (±20%)','Объём работы выходит за диапазон ±20% от лимита');}
 if(input.importFactoring==='yes')add('deviation','Пункт 4: импортный факторинг — неприоритетный продукт');else if(input.importFactoring!=='no')add('missing','Уточните, является ли факторинг импортным');
 if(input.programSupport==='yes')add('pass','Пункт 4: программный факторинг с поддержкой поставщика — приоритет');
 if(input.marketplace==='yes')add('deviation','Реализация через маркетплейсы с хранением на их складах: ограничение по рыночной конъюнктуре');else if(input.marketplace!=='no')add('missing','Проверьте реализацию через маркетплейсы с хранением на их складах');
 if(input.appliance==='yes')add('deviation','Торговля БТиЭ, кроме крупнейших: ограничение по рыночной конъюнктуре');else if(input.appliance!=='no')add('missing','Подтвердите отсутствие ограничения по торговле БТиЭ либо применимость исключения для крупнейших');
 if(input.lowRecourse==='yes'&&input.product?.includes('Закрытый'))add('deviation','При низкой регрессоспособности клиента предпочтителен открытый факторинг');
 if(input.product?.includes('Закрытый')&&(!input.lowRecourse||input.lowRecourse==='u'))add('missing','Оцените регрессоспособность клиента для проверки рекомендации по структуре');
 if(input.mitigation==='yes')positive.push('Есть механизмы снижения риска: обеспечение, страхование или иные меры');
 if(input.guarantee==='yes')positive.push('Есть поручительство собственников клиента и/или дебитора');
 const recourse=input.recourse==='auto'?(input.product?.includes('без регресса')?'no':input.product?.includes('с регрессом')?'yes':'u'):input.recourse;
 if(!recourse||recourse==='u')add('missing','Уточните наличие регресса: от него зависит необходимость оценки клиента как носителя риска');
 const parties={client:priority(input.client),debtor:priority(input.debtor)};
 const required=['debtor',...(recourse==='yes'?['client']:[])];
 for(const [key,label] of [['client','Клиент'],['debtor','Дебитор']]){
  const p=input[key],res=parties[key];
  if(!p.innValid)add('missing',label+': ИНН не подтверждён');
  if(!p.region||p.region==='Другой регион')add('missing',label+': регион регистрации не подтверждён');
  if(p.legacyRegionStop)add('stop',label+': территориальное ограничение исходного интерфейса (на присланных фото не описано)');
  if(p.sector==='yes')add('deviation',label+': высокорискованная, неприоритетная отрасль по пункту 3');else if(p.sector!=='no')add('missing',label+': подтвердите отрасль с учётом исключений пункта 3');
  if(required.includes(key)){
   if(res.tier)add('pass',label+': '+res.tier+'-й эшелон ('+res.matched.join('; ')+')');
   else if(res.outside)add('deviation',label+': соответствие первому и второму эшелону не выявлено — индивидуальное рассмотрение');
   else add('missing',label+': эшелон не определён; заполните внутренние оценки и подтверждения');
  }
 }
 if(!input.assessmentEvidence?.trim())add('missing','Укажите источник и дату подтверждения внутренних оценок и рейтингов');
 const status=stops.length?'Не рекомендовано: выявлен запрет':unknown.length?'Решение отложено: недостаточно подтверждений':deviations.length?'Неприоритетная сделка: индивидуальное рассмотрение':'Предварительно соответствует приоритетному профилю';
 return {status,kind:stops.length?'stop':unknown.length||deviations.length?'warn':'good',stops,deviations,unknown,positive,checks,parties,required,recourse,limit,range:limit>0?[limit*.8,limit*1.2]:null};
}
const api={priority,evaluate};if(typeof module==='object'&&module.exports)module.exports=api;else root.SPPRMethodology=api;
})(typeof globalThis==='object'?globalThis:this);
