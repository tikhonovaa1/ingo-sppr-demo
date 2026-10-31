'use strict';
const choice=[['u','Не подтверждено'],['yes','Да'],['no','Нет']];
function policySelect(id,label,options=choice){return '<div class="field"><label for="'+id+'">'+label+'</label><select id="'+id+'">'+options.map(([v,t])=>'<option value="'+v+'">'+t+'</option>').join('')+'</select></div>'}
function policyNumber(id,label){return '<div class="field"><label for="'+id+'">'+label+'</label><input id="'+id+'" type="number" min="0" step="any" placeholder="Не подтверждено"></div>'}
for(const [p,label] of [['client','Клиент'],['debtor','Дебитор']]){
 const el=$(p+'PolicyFields');
 el.innerHTML='<h3>Подтверждения для определения эшелона</h3><div class="auto-note">Чекко не присваивает внутреннюю группу платёжеспособности или оценку ФП Банка. Заполните подтверждённые значения. Для присвоения эшелона достаточно одной полностью выполненной ветви критериев.</div><div class="fields">'+
 policySelect(p+'PayGroup','Группа платёжеспособности',[['u','Не подтверждена'],['1','1-я группа'],['2','2-я группа'],['other','Иная группа']])+
 policySelect(p+'FP','Оценка финансового положения',[['u','Не подтверждена'],['good','Хорошее'],['medium','Среднее'],['poor','Хуже среднего']])+
 policySelect(p+'Independent','Высокая финансовая независимость')+
 policySelect(p+'Stable','Устойчивый финансовый профиль')+
 policySelect(p+'Federal','Федеральная розничная сеть')+
 policyNumber(p+'OverdueDays','Средневзвешенная просрочка, дней')+
 policySelect(p+'ExternalRating','Внешний рейтинг организации / группы',[['u','Не подтверждён'],['a','Порог не ниже A− подтверждён'],['b','Не ниже B, но ниже A−'],['below','Ниже B / рейтинг отсутствует']])+
 policySelect(p+'BankRating','Внутренний кредитный рейтинг',[['u','Не подтверждён'],...Array.from({length:9},(_,i)=>['P'+(i+1),'P'+(i+1)]),['outside','Вне P1–P9 / отсутствует']])+
 policySelect(p+'Middle','Предприятие среднего бизнеса')+
 policySelect(p+'History','Положительная кредитная история')+
 policySelect(p+'Sector','Неприоритетная отрасль по пункту 3')+'</div><div id="'+p+'PriorityResult" class="auto-note"></div>';
}
$('methodologyDealFields').innerHTML='<div class="fields">'+
 policySelect('deliveryStage','Стадия финансирования',[['u','Не подтверждена'],['post','После поставки'],['pre','До поставки (предпоставочный факторинг)']])+
 policySelect('recoursePolicy','Наличие регресса',[['auto','По выбранному продукту'],['yes','С регрессом'],['no','Без регресса'],['u','Не подтверждено']])+
 policyNumber('experienceMonths','Опыт работы поставщика с дебитором, месяцев')+
 policyNumber('relationshipVolume','Сопоставимый объём работы, ₽')+
 '<div class="field wide"><label for="volumeBasis">Период и источник подтверждения объёма работы</label><input id="volumeBasis" placeholder="Период, документы и сопоставимость объёма с лимитом"></div>'+
 policySelect('importFactoring','Импортный факторинг')+
 policySelect('programSupport','Программный факторинг с поддержкой поставщика')+
 policySelect('marketplaceStorage','Реализация через маркетплейсы с хранением на их складах')+
 policySelect('applianceRestriction','Торговля БТиЭ без подтверждённого исключения для крупнейших')+
 policySelect('lowRecourse','Низкая регрессоспособность клиента')+
 policySelect('riskMitigation','Есть обеспечение, страхование или иные меры снижения риска')+
 policySelect('ownerGuarantee','Есть поручительство собственников клиента / дебитора')+
 '<div class="field wide"><label for="assessmentEvidence">Источник и дата подтверждения внутренних оценок и рейтингов</label><textarea id="assessmentEvidence" rows="3" placeholder="Кто подтвердил ФП, группу платёжеспособности, рейтинги, независимость и устойчивость; дата и документы. Для рейтинга группы подтвердите вхождение компании в периметр консолидации."></textarea></div></div>';
function policyParty(p){return {...data(p),innValid:validInn($(p+'Inn').value.trim()),legacyRegionStop:stopRegions.some(t=>$(p+'Region').value.toLowerCase().includes(t)),payGroup:$(p+'PayGroup').value,fp:$(p+'FP').value,independence:$(p+'Independent').value,stability:$(p+'Stable').value,federalRetail:$(p+'Federal').value,overdueDays:$(p+'OverdueDays').value,externalRating:$(p+'ExternalRating').value,bankRating:$(p+'BankRating').value,middleBusiness:$(p+'Middle').value,positiveHistory:$(p+'History').value,sector:$(p+'Sector').value}}
function readPolicy(){return {client:policyParty('client'),debtor:policyParty('debtor'),product:$('product').value,limit:$('limit').value,delay:$('delay').value,delivery:$('deliveryStage').value,recourse:$('recoursePolicy').value,experienceMonths:$('experienceMonths').value,relationshipVolume:$('relationshipVolume').value,volumeBasis:$('volumeBasis').value,importFactoring:$('importFactoring').value,programSupport:$('programSupport').value,marketplace:$('marketplaceStorage').value,appliance:$('applianceRestriction').value,lowRecourse:$('lowRecourse').value,mitigation:$('riskMitigation').value,guarantee:$('ownerGuarantee').value,assessmentEvidence:$('assessmentEvidence').value}}
function showPriority(p,result){
 const status=result.tier?result.tier+'-й эшелон: '+result.matched.join('; '):result.outside?'Соответствие первому и второму эшелону не выявлено':'Эшелон не определён: нужны подтверждения';
 $(p+'PriorityResult').innerHTML='<strong>'+esc(status)+'</strong><details><summary>Проверка ветвей методологии</summary>'+result.paths.map(path=>'<div style="margin:10px 0"><strong>'+esc(path.name)+'</strong>'+path.rules.map(r=>'<div>'+esc(r.state===true?'✓ ':r.state===false?'✗ ':'? ')+esc(r.label)+'</div>').join('')+'</div>').join('')+'</details>';
 return status;
}
assess=function(){
 const input=readPolicy(),result=SPPRMethodology.evaluate(input);
 const clientPriority=showPriority('client',result.parties.client),debtorPriority=showPriority('debtor',result.parties.debtor);
 $('status').className='status '+result.kind;$('status').textContent=result.status;
 $('assessmentSummary').textContent=result.status+' · запрашиваемый лимит '+money(Number(input.limit)||null);
 $('mLimit').textContent=money(Number(input.limit)||null);
 const present=['client','debtor'].reduce((n,p)=>n+Object.keys(financialFields).filter(k=>input[p][k]!==null).length,0);$('mData').textContent=present+'/10';
 const sections=[['ЗАПРЕТ',result.stops,'stop'],['ОТКЛОНЕНИЕ',result.deviations,''],['НЕ ПОДТВЕРЖДЕНО',result.unknown,''],['СООТВЕТСТВУЕТ',result.positive,'ok']];
 $('factors').innerHTML=sections.flatMap(([label,items,kind])=>items.map(item=>'<div class="item"><span class="flag '+kind+'">'+label+'</span>'+esc(item)+'</div>')).join('');
 const reasoning=result.stops.length?'Выявлено запрещающее условие. Основание приведено в разделе «ЗАПРЕТ».':result.unknown.length?'Предварительное решение отложено до подтверждения перечисленных условий. Отсутствие внутренней оценки не означает отрицательный результат.':result.deviations.length?'Есть отклонения от приоритетного профиля. Методология не задаёт для них автоматический отказ: требуется индивидуальное рассмотрение.':'По подтверждённым условиям сделка соответствует приоритетному профилю предоставленных фрагментов методологии. Можно переходить к дальнейшему рассмотрению.';
 $('rationale').textContent=reasoning+' Риск отражается на дебитора'+(result.recourse==='yes'?', при наличии регресса дополнительно оценивается клиент.':'.')+' Подтверждённый лимит Банка не рассчитывается: формулы лимита и балльной шкалы в предоставленных фрагментах нет.';
 $('volumeRange').textContent=result.range?'Для запрашиваемого лимита сопоставимый объём: '+money(result.range[0])+' – '+money(result.range[1])+'. Укажите период сопоставления и источник.':'Укажите лимит для расчёта диапазона сопоставимого объёма (±20%).';
 last='ПРЕДВАРИТЕЛЬНОЕ ЗАКЛЮЧЕНИЕ СППР\n'+new Date().toLocaleString('ru-RU')+'\nМетодология: предоставленные пользователем фрагменты, пункты 1–4\nРезультат: '+result.status+'\nЗапрашиваемый лимит: '+money(Number(input.limit)||null)+'\nКлиент: '+input.client.name+'; ИНН '+$('clientInn').value+'; '+clientPriority+'\nДебитор: '+input.debtor.name+'; ИНН '+$('debtorInn').value+'; '+debtorPriority+'\nПродукт: '+input.product+'\nПолнота финансов: '+present+'/10 (не балл)\n'+$('volumeRange').textContent+'\n\n'+sections.map(([label,items])=>label+':\n'+(items.join('\n')||'нет')).join('\n\n')+'\n\nОбоснование: '+$('rationale').textContent+'\nПодтверждения аналитика: '+input.assessmentEvidence+'\nИсточники: '+$('sources').value+'\nНе является окончательным кредитным одобрением Банка.';
};
for(const container of ['clientPolicyFields','debtorPolicyFields','methodologyDealFields'])$(container).addEventListener('input',refreshScoring);
// Never keep the previous company's internal assessments after an INN change or refresh.
const originalClearParty=clearParty;
clearParty=function(p){originalClearParty(p);for(const suffix of ['PayGroup','FP','Independent','Stable','Federal','ExternalRating','BankRating','Middle','History','Sector'])$(p+suffix).value='u';$(p+'OverdueDays').value='';$(p+'PriorityResult').textContent='Нужны подтверждения для этой стороны.';refreshScoring()};
refreshScoring();
