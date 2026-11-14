(() => {
  'use strict';
  const STORAGE_KEY = 'focus-autokosten-v1';
  const CATEGORIES = {
    onderhoud: 'Onderhoud', reparatie: 'Reparatie', apk: 'APK / keuring', verzekering: 'Verzekering', wegenbelasting: 'Wegenbelasting', banden: 'Banden', parkeren: 'Parkeren / tol', wassen: 'Wassen', pechhulp: 'Pechhulp', accessoires: 'Accessoires', afschrijving: 'Afschrijving', overig: 'Overige kosten'
  };
  const PAGE_NAMES = {dashboard:'Overzicht',fuel:'Tankbeurten',expenses:'Uitgaven',income:'Vergoedingen',car:'Mijn auto'};
  const nfMoney = new Intl.NumberFormat('nl-NL', {style:'currency',currency:'EUR'});
  const nfNum = new Intl.NumberFormat('nl-NL', {maximumFractionDigits:1});
  const nf2 = new Intl.NumberFormat('nl-NL', {minimumFractionDigits:2,maximumFractionDigits:2});
  const dateFormatter = new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric'});
  const money = v => nfMoney.format(Number.isFinite(Number(v)) ? Number(v) : 0);
  const num = v => nfNum.format(Number(v) || 0);
  const decimal = v => nf2.format(Number(v) || 0);
  const localDate = d => { const z = d || new Date();return `${z.getFullYear()}-${String(z.getMonth()+1).padStart(2,'0')}-${String(z.getDate()).padStart(2,'0')}`; };
  const formatDate = iso => iso ? dateFormatter.format(new Date(`${iso}T12:00:00`)) : 'Niet ingevuld';
  const safe = str => String(str??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const str = (val,max=160) => String(val??'').trim().slice(0,max);
  const n = val => { const x = Number(String(val??'').replace(',','.'));return Number.isFinite(x)?x:0; };
  const nn = val => Math.max(0,n(val));
  const amount = val => Math.round(nn(val)*100)/100;
  const isDate = s => /^\d{4}-\d\d-\d\d$/.test(String(s)) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime());
  const randomId = () => (globalThis.crypto?.randomUUID?.() || `id_${Date.now()}_${Math.random().toString(36).slice(2,11)}`);
  const icon = name => `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const emptyState = (headline,desc,kind) => `<div class="empty-state">${icon(kind==='fuel'?'fuel':kind==='income'?'road':'car')}<strong>${safe(headline)}</strong><p>${safe(desc)}</p>${kind?`<button class="btn btn-light btn-sm" data-action="add" data-kind="${kind}">${icon('plus')} Eerste invoer toevoegen</button>`:''}</div>`;
  const defaultState = () => ({version:1,settings:{make:'Ford',model:'Focus',year:'2004',plate:'',startOdometer:'',apkDate:'',kmRate:0.23,dayRate:16.75},entries:[]});
  const saneNumber = (x,limit=1e9) => Math.min(limit,nn(x));
  function normalizeState(obj){
    if(!obj || typeof obj !== 'object' || !Array.isArray(obj.entries)) throw Error('Dit is geen geldige back-up van Focus Autokosten.');
    if(obj.entries.length>20000) throw Error('Deze back-up bevat te veel boekingen.');
    const orig=obj.settings && typeof obj.settings==='object'?obj.settings:{};
    const settings={make:str(orig.make||'Ford',40),model:str(orig.model||'Focus',50),year:str(orig.year||'2004',4),plate:str(orig.plate,20),startOdometer:orig.startOdometer===''?'':saneNumber(orig.startOdometer),apkDate:isDate(orig.apkDate)?orig.apkDate:'',kmRate:saneNumber(orig.kmRate??.23,10),dayRate:saneNumber(orig.dayRate??16.75,1000)};
    const entries=obj.entries.filter(e=>e && ['fuel','expense','income'].includes(e.kind) && isDate(e.date)).map(e=>({
      id:str(e.id||randomId(),80),kind:e.kind,date:e.date,
      liters:saneNumber(e.liters,10000),total:amount(e.total),odometer:e.odometer==='' || e.odometer===null || e.odometer===undefined?'':saneNumber(e.odometer),fullTank:Boolean(e.fullTank),station:str(e.station),
      category:CATEGORIES[e.category]?e.category:'overig',description:str(e.description,160),notes:str(e.notes,400),
      type:['fuel','km','day'].includes(e.type)?e.type:'km',distance:saneNumber(e.distance,1e7),days:saneNumber(e.days,366),rate:saneNumber(e.rate,e.type==='day'?1000:10)
    }));
    return {version:1,settings,entries};
  }
  function loadState(){try{let raw=localStorage.getItem(STORAGE_KEY);return raw?normalizeState(JSON.parse(raw)):defaultState();}catch(e){console.error(e);return defaultState();}}
  let state=loadState();
  let page='dashboard';
  let period='all';
  let editing=null;
  let toastTimeout=null;
  const content=document.getElementById('appContent');
  const modalRoot=document.getElementById('modalRoot');
  const escapeAttribute = safe;
  function persist(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(state));return true;}catch(e){notify('Opslaan mislukt. De opslagruimte van je browser kan vol zijn.');return false;}}
  function notify(message){const el=document.getElementById('toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>el.classList.remove('show'),3500);}
  function allEntries(kind){return state.entries.filter(x=>!kind||x.kind===kind).sort((a,b)=>b.date.localeCompare(a.date)||(String(b.id).localeCompare(String(a.id))));}
  function dateInPeriod(e){const d=localDate(),year=d.slice(0,4),month=d.slice(0,7);return period==='all'||(period==='year'&&e.date.startsWith(year))||(period==='month'&&e.date.startsWith(month));}
  function totals(entries){let expenses=0,reimb=0,fuel=0,other=0,liters=0,kms=0,days=0;for(const e of entries){if(e.kind==='fuel'){fuel+=e.total;expenses+=e.total;liters+=e.liters;}else if(e.kind==='expense'){other+=e.total;expenses+=e.total;}else{reimb+=e.total;kms+=e.type==='km'?e.distance:0;days+=e.type==='day'?e.days:0;}}return {expenses,reimb,net:expenses-reimb,fuel,other,liters,kms,days};}
  function avgFuelPrice(entries){const fuel=entries.filter(e=>e.kind==='fuel'&&e.liters>0);const liters=fuel.reduce((a,e)=>a+e.liters,0);return liters?fuel.reduce((a,e)=>a+e.total,0)/liters:null;}
  function fuelConsumption(){
    const fills=allEntries('fuel').filter(x=>x.odometer!==''&&x.odometer>0&&x.liters>0).sort((a,b)=>Number(a.odometer)-Number(b.odometer)||a.date.localeCompare(b.date));
    let previousFull=null,literBucket=0,validDistance=0,validLiters=0;
    for(const fill of fills){
      if(previousFull){literBucket+=fill.liters;if(fill.fullTank){const distance=Number(fill.odometer)-Number(previousFull.odometer);const fuelPer100=literBucket/distance*100;if(distance>=25&&distance<=3000&&fuelPer100>=2&&fuelPer100<=35){validDistance+=distance;validLiters+=literBucket;}previousFull=fill;literBucket=0;}}
      else if(fill.fullTank){previousFull=fill;}
    }
    return validDistance>0?validLiters*100/validDistance:null;
  }
  function trackedDistance(){
    const readings=state.entries.map(e=>e.odometer).filter(v=>v!==''&&Number.isFinite(Number(v))).map(Number).sort((a,b)=>a-b);
    if(!readings.length)return null;
    const start=state.settings.startOdometer!==''?Number(state.settings.startOdometer):(readings.length>1?readings[0]:null);
    return start!==null&&readings[readings.length-1]>start?readings[readings.length-1]-start:null;
  }
  function apkInfo(){const d=state.settings.apkDate;if(!d)return {text:'Nog niet ingesteld',status:'Vul je APK-vervaldatum in',cls:'soon'};const now=new Date(`${localDate()}T12:00:00`),until=new Date(`${d}T12:00:00`);const days=Math.round((until-now)/86400000);return {text:formatDate(d),status:days<0?`${Math.abs(days)} dagen verlopen`:days===0?'APK vervalt vandaag':days<=45?`Nog ${days} dagen geldig`:`Nog ${days} dagen geldig`,cls:days<0?'late':days<=45?'soon':''};}
  function activityName(e){if(e.kind==='fuel')return e.station?`Tankbeurt • ${e.station}`:'Tankbeurt';if(e.kind==='expense')return e.description||CATEGORIES[e.category]||'Uitgave';return e.description||(e.type==='day'?'Reiskostenvergoeding werkdagen':e.type==='km'?'Kilometervergoeding':'Benzinevergoeding');}
  function activityMeta(e){if(e.kind==='fuel')return `${formatDate(e.date)} • ${num(e.liters)} liter`;if(e.kind==='expense')return `${formatDate(e.date)} • ${CATEGORIES[e.category]||'Overig'}`;return `${formatDate(e.date)} • ${e.type==='day'?`${num(e.days)} gewerkte ${e.days===1?'dag':'dagen'}`:e.type==='km'?`${num(e.distance)} km`:'Benzinevergoeding'}`;}
  function activityRows(entries){if(!entries.length)return emptyState('Nog geen boekingen','Voeg je eerste tankbeurt, uitgave of vergoeding toe.',null);return `<div class="recent-list">${entries.map(e=>`<div class="activity-row"><div class="activity-symbol ${e.kind}">${icon(e.kind==='fuel'?'fuel':e.kind==='expense'?'wrench':'road')}</div><div class="activity-main"><strong>${safe(activityName(e))}</strong><span>${safe(activityMeta(e))}</span></div><div class="activity-amount ${e.kind==='income'?'positive':'negative'}">${e.kind==='income'?'+':'−'} ${money(e.total)}</div><button class="btn-plain activity-arrow" title="Bewerken" aria-label="Boeking bewerken" data-action="edit" data-id="${escapeAttribute(e.id)}">${icon('chevron')}</button></div>`).join('')}</div>`;}
  function metric(title,value,note,iconName,tone='green'){return `<article class="metric-card"><div class="metric-header"><span>${safe(title)}</span><div class="metric-icon tone-${tone}">${icon(iconName)}</div></div><div class="metric-value">${value}</div><div class="metric-note">${safe(note)}</div></article>`;}
  function periodButtons(){return `<div class="period-switch" role="group" aria-label="Periode"><button type="button" data-period="month" class="${period==='month'?'selected':''}">Maand</button><button type="button" data-period="year" class="${period==='year'?'selected':''}">Jaar</button><button type="button" data-period="all" class="${period==='all'?'selected':''}">Alles</button></div>`;}
  function chartHtml(){
    const months=[],today=new Date();for(let x=5;x>=0;x--){const d=new Date(today.getFullYear(),today.getMonth()-x,1);const prefix=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;const tally=totals(state.entries.filter(e=>e.date.startsWith(prefix)));months.push({label:new Intl.DateTimeFormat('nl-NL',{month:'short'}).format(d),cost:tally.expenses,earn:tally.reimb});}
    const max=Math.max(10,...months.flatMap(e=>[e.cost,e.earn]));
    return `<div class="chart-area" aria-label="Uitgaven en vergoedingen per maand in de afgelopen zes maanden">${months.map(e=>`<div class="chart-month"><div class="chart-bars"><div class="chart-bar cost" title="Uitgaven: ${money(e.cost)}" style="height:${Math.max(2,e.cost/max*174)}px"></div><div class="chart-bar income" title="Vergoedingen: ${money(e.earn)}" style="height:${Math.max(2,e.earn/max*174)}px"></div></div><div class="chart-month-label">${safe(e.label)}</div></div>`).join('')}</div>`;
  }
  function carIllustration(){return `<div class="hero-art" aria-hidden="true"><svg viewBox="0 0 470 220" xmlns="http://www.w3.org/2000/svg"><path class="art-shadow" d="M36 173c16-32 34-43 61-49l60-18 30-53c13-20 31-23 59-24l79 2c15 0 28 12 43 29l45 55 27 13c13 6 15 15 14 38v13H30z"/><path d="M35 171c6-21 20-31 49-39l72-19 33-53c12-20 27-24 57-24h70c19 0 30 9 45 27l44 55 31 13c9 5 13 11 13 29v15h-22"/><path d="M65 174H30v-16m105 17h205"/><path d="m165 115 32-50c7-10 20-15 36-15h18v64zm102 0V50h49c14 0 21 5 34 21l34 44z"/><path d="m35 157 25 4m362-4 28-4M272 128h23M154 127h19"/><circle cx="103" cy="174" r="31"/><circle cx="103" cy="174" r="16"/><circle cx="383" cy="174" r="31"/><circle cx="383" cy="174" r="16"/><path d="M26 202h432"/></svg></div>`;}
  function heading(title,sub,eyebrow='JOUW AUTO',actions=''){return `<div class="page-heading"><div><div class="eyebrow">${safe(eyebrow)}</div><h1 class="page-title">${safe(title)}</h1><p class="page-subtitle">${safe(sub)}</p></div>${actions}</div>`;}
  function renderDashboard(){
    const p=totals(state.entries.filter(dateInPeriod)),a=apkInfo(),usage=fuelConsumption(),price=avgFuelPrice(state.entries.filter(dateInPeriod));
    const recent=allEntries().slice(0,5);
    content.innerHTML=`${heading('Jouw auto in één overzicht','Alle uitgaven en ontvangen vergoedingen bij elkaar.','FOCUS AUTOKOSTEN',periodButtons())}
      <section class="hero">${carIllustration()}<div class="hero-content"><div class="hero-label">NETTO AUTOKOSTEN</div><div class="hero-amount">${money(p.net)}</div><div class="hero-details">${money(p.expenses)} uitgaven <strong>−</strong> ${money(p.reimb)} ontvangen vergoedingen</div><div class="hero-pill">${icon('car')} ${safe(state.settings.make)} ${safe(state.settings.model)} · ${safe(state.settings.year)}</div></div></section>
      <section class="summary-grid" aria-label="Kerncijfers">
        ${metric('Totale uitgaven',money(p.expenses),'Inclusief brandstof','wallet','red')}
        ${metric('Vergoedingen',money(p.reimb),'Werkdagen, km en benzine','road','green')}
        ${metric('Gem. brandstofprijs',price===null?'—':`${money(price)} / l`,'Gewogen gemiddelde','fuel','orange')}
        ${metric('Benzineverbruik',usage===null?'—':`${decimal(usage)} l`,'Per 100 km, volgetankt','activity','blue')}
      </section>
      <div class="dashboard-body"><div class="stack">
        <section class="panel"><div class="panel-title-row"><div><h2 class="panel-title">Kosten en vergoedingen</h2><p class="panel-subtitle">De laatste 6 maanden</p></div><div class="tiny-legend"><span><i class="legend-dot"></i> Uitgaven</span><span><i class="legend-dot green"></i> Vergoeding</span></div></div>${chartHtml()}<div class="chart-footer"><span>Totaal ingevoerd in gekozen periode</span><strong>${money(p.expenses+p.reimb)}</strong></div></section>
      </div><div class="stack">
        <section class="panel"><div class="panel-title-row" style="margin-bottom:0"><div><h2 class="panel-title">APK herinnering</h2><p class="panel-subtitle">Houd je keuringsdatum bij</p></div>${icon('calendar')}</div><div class="apk-content"><div class="apk-icon">${icon('calendar')}</div><div class="apk-text"><strong>${safe(a.text)}</strong><span>Vervaldatum APK</span></div></div><div class="apk-status ${a.cls}">${safe(a.status)}</div><button class="small-link" data-page="car" style="margin-top:10px">${state.settings.apkDate?'Datum aanpassen':'Datum instellen'} ${icon('arrow')}</button></section>
        <section class="panel"><div class="panel-title-row" style="margin-bottom:0"><div><h2 class="panel-title">Snel toevoegen</h2><p class="panel-subtitle">Zet nieuwe kosten direct in je overzicht</p></div></div><div class="quick-buttons"><button class="quick-action" data-action="add" data-kind="fuel">${icon('fuel')} Tankbeurt</button><button class="quick-action" data-action="add" data-kind="expense">${icon('wrench')} Reparatie / APK</button><button class="quick-action" data-action="add" data-kind="income">${icon('road')} Vergoeding</button><button class="quick-action" data-page="car">${icon('car')} Autogegevens</button></div></section>
      </div></div>
      <section class="panel"><div class="panel-title-row"><div><h2 class="panel-title">Laatste boekingen</h2><p class="panel-subtitle">De nieuwste wijzigingen in jouw autokosten</p></div></div>${activityRows(recent)}</section>`;
  }
  function cellActions(e){return `<td class="actions"><button class="btn-plain" aria-label="Bewerken" title="Bewerken" data-action="edit" data-id="${escapeAttribute(e.id)}">${icon('edit')}</button><button class="btn-plain" aria-label="Verwijderen" title="Verwijderen" data-action="delete" data-id="${escapeAttribute(e.id)}">${icon('trash')}</button></td>`;}
  function table(kind){
    const entries=allEntries(kind);
    if(!entries.length)return `<div class="data-card">${emptyState(kind==='fuel'?'Nog geen tankbeurten':kind==='expense'?'Nog geen uitgaven':'Nog geen vergoedingen',kind==='fuel'?'Voeg een tankbeurt met liters en kilometerstand toe.':kind==='expense'?'Begin bijvoorbeeld met een APK of reparatie.':'Registreer jouw vergoeding per gewerkte dag, per kilometer of als los bedrag.',kind)}</div>`;
    let header='',body='';
    if(kind==='fuel'){
      header='<th>Datum</th><th>Omschrijving</th><th>Liters</th><th>Km-stand</th><th>Prijs / liter</th><th>Bedrag</th><th></th>';
      body=entries.map(e=>`<tr data-search="${escapeAttribute(`${e.date} ${e.station} ${e.odometer} ${e.liters}`.toLowerCase())}"><td>${formatDate(e.date)}</td><td class="primary">${safe(e.station||'Tankbeurt')} ${e.fullTank?'<span class="tag tag-green">Vol</span>':''}</td><td>${decimal(e.liters)} l</td><td>${e.odometer!==''?`${num(e.odometer)} km`:'—'}</td><td>${e.liters>0?money(e.total/e.liters):'—'}</td><td class="amount">${money(e.total)}</td>${cellActions(e)}</tr>`).join('');
    }else if(kind==='expense'){
      header='<th>Datum</th><th>Soort</th><th>Omschrijving</th><th>Km-stand</th><th>Bedrag</th><th></th>';
      body=entries.map(e=>`<tr data-search="${escapeAttribute(`${e.date} ${CATEGORIES[e.category]} ${e.description} ${e.notes}`.toLowerCase())}"><td>${formatDate(e.date)}</td><td><span class="tag tag-blue">${safe(CATEGORIES[e.category])}</span></td><td class="primary">${safe(e.description||CATEGORIES[e.category])}</td><td>${e.odometer!==''?`${num(e.odometer)} km`:'—'}</td><td class="amount">${money(e.total)}</td>${cellActions(e)}</tr>`).join('');
    }else{
      header='<th>Datum</th><th>Vergoeding</th><th>Omschrijving</th><th>Dagen / km</th><th>Tarief</th><th>Ontvangen</th><th></th>';
      body=entries.map(e=>`<tr data-search="${escapeAttribute(`${e.date} ${e.type==='day'?'werkdagen dagvergoeding':e.type==='km'?'kilometer':'benzine'} ${e.description}`.toLowerCase())}"><td>${formatDate(e.date)}</td><td><span class="tag ${e.type==='day'?'tag-green':e.type==='km'?'tag-blue':'tag-orange'}">${e.type==='day'?'Werkdagen':e.type==='km'?'Kilometer':'Benzine'}</span></td><td class="primary">${safe(e.description||'Vergoeding')}</td><td>${e.type==='day'?`${num(e.days)} dagen`:e.distance?`${num(e.distance)} km`:'—'}</td><td>${e.type==='day'?`${money(e.rate)} / dag`:e.type==='km'?`${money(e.rate)} / km`:'—'}</td><td class="amount positive">+ ${money(e.total)}</td>${cellActions(e)}</tr>`).join('');
    }
    return `<div class="data-card"><div class="list-toolbar"><span class="record-count" id="recordCount">${entries.length} ${entries.length===1?'boeking':'boekingen'}</span><input class="filter-search" type="search" id="recordSearch" placeholder="Zoeken in boekingen..." aria-label="Zoeken in boekingen"></div><div class="table-wrapper"><table class="records-table"><thead><tr>${header}</tr></thead><tbody id="recordsBody">${body}</tbody></table></div><div id="noSearchResults" style="display:none">${emptyState('Geen resultaten','Probeer een andere zoekterm.',null)}</div></div>`;
  }
  function renderFuel(){const es=allEntries('fuel'),s=totals(es),usage=fuelConsumption(),p=avgFuelPrice(es);content.innerHTML=`${heading('Tankbeurten','Bekijk wat je tankt en wat je benzine werkelijk kost.','BENZINE & VERBRUIK',`<button class="btn btn-primary" data-action="add" data-kind="fuel">${icon('plus')} Tankbeurt toevoegen</button>`)}<section class="page-kpi-grid">${metric('Totaal benzinekosten',money(s.fuel),'Alle geregistreerde tankbeurten','wallet','red')}${metric('Totaal getankt',`${decimal(s.liters)} l`,`${es.length} tankbeurten`,'fuel','orange')}${metric('Gem. verbruik',usage===null?'—':`${decimal(usage)} l / 100 km`,p===null?'Voer tankbeurten in':`Gem. ${money(p)} per liter`,'activity','green')}</section><div class="info-banner">${icon('info')}<div>Voor een betrouwbaar verbruik vul je bij het tanken de kilometerstand in en vink je <strong>tank volledig gevuld</strong> aan. De app gebruikt dan de afstand en liters tussen volle tankbeurten.</div></div>${table('fuel')}`;}
  function renderExpenses(){const es=allEntries('expense'),s=totals(es),repair=es.filter(e=>['reparatie','onderhoud','banden'].includes(e.category)).reduce((a,e)=>a+e.total,0),apk=es.filter(e=>e.category==='apk').reduce((a,e)=>a+e.total,0);content.innerHTML=`${heading('Uitgaven en onderhoud','Alles van reparaties en APK tot verzekering en wegenbelasting.','ALLE AUTOKOSTEN',`<button class="btn btn-primary" data-action="add" data-kind="expense">${icon('plus')} Uitgave toevoegen</button>`)}<section class="page-kpi-grid">${metric('Overige autokosten',money(s.other),'Exclusief tankbeurten','wallet','red')}${metric('Reparatie en onderhoud',money(repair),'Inclusief banden','wrench','orange')}${metric('APK kosten',money(apk),'Alle keuringen','calendar','blue')}</section>${table('expense')}`;}
  function renderIncome(){const es=allEntries('income'),s=totals(es),kmTotal=es.filter(e=>e.type==='km').reduce((a,e)=>a+e.total,0),dayTotal=es.filter(e=>e.type==='day').reduce((a,e)=>a+e.total,0),petrol=es.filter(e=>e.type==='fuel').reduce((a,e)=>a+e.total,0);content.innerHTML=`${heading('Ontvangen vergoedingen',`Jouw vaste reiskostenvergoeding is ${money(state.settings.dayRate)} per gewerkte dag.`,'JOUW VERGOEDINGEN',`<button class="btn btn-primary" data-action="add" data-kind="income">${icon('plus')} Vergoeding toevoegen</button>`)}<section class="page-kpi-grid">${metric('Totaal vergoedingen',money(s.reimb),'In mindering op je autokosten','wallet','green')}${metric('Vergoeding werkdagen',money(dayTotal),`${num(s.days)} gewerkte dagen`,'calendar','blue')}${metric('Overige vergoedingen',money(kmTotal+petrol),'Kilometervergoeding en losse bedragen','fuel','orange')}</section><div class="info-banner">${icon('info')}<div>Vul het werkelijke <strong>aantal gewerkte dagen</strong> in. De app rekent dit automatisch uit met ${money(state.settings.dayRate)} per dag. Vakantie, ziekte en vrije dagen tellen alleen mee wanneer je daarvoor ook reiskostenvergoeding ontvangt. Voer dezelfde vergoeding niet dubbel in.</div></div>${table('income')}`;}
  function renderCar(){const a=apkInfo(),distance=trackedDistance(),total=totals(state.entries),costKm=distance&&distance>0?total.expenses/distance:null,s=state.settings;
    content.innerHTML=`${heading('Mijn Ford Focus','Autogegevens, vergoeding per werkdag en back-ups.','INSTELLINGEN')}
      <div class="settings-grid"><div class="stack"><section class="panel"><div class="panel-title-row"><div><h2 class="panel-title">Autogegevens</h2><p class="panel-subtitle">Gegevens voor het dashboard en jouw berekeningen</p></div>${icon('car')}</div><form id="settingsForm"><div class="field-grid"><div class="field"><label for="carMake">Merk</label><input id="carMake" name="make" maxlength="40" value="${escapeAttribute(s.make)}" required></div><div class="field"><label for="carModel">Model</label><input id="carModel" name="model" maxlength="50" value="${escapeAttribute(s.model)}" required></div><div class="field"><label for="carYear">Bouwjaar</label><input id="carYear" name="year" type="number" min="1900" max="2100" value="${escapeAttribute(s.year)}" required></div><div class="field"><label for="carPlate">Kenteken</label><input id="carPlate" name="plate" maxlength="20" placeholder="Bijv. 12-AB-34" value="${escapeAttribute(s.plate)}"></div><div class="field"><label for="carOdometer">Start kilometerstand</label><input id="carOdometer" name="startOdometer" type="number" min="0" step="1" placeholder="Bijv. 180000" value="${s.startOdometer===''?'':s.startOdometer}"><small>Km-stand bij begin van jouw registratie</small></div><div class="field"><label for="carApk">APK vervaldatum</label><input id="carApk" name="apkDate" type="date" value="${escapeAttribute(s.apkDate)}"></div><div class="field"><label for="carDayRate">Reiskostenvergoeding per werkdag in €</label><input id="carDayRate" name="dayRate" type="number" step="0.01" min="0" max="1000" value="${s.dayRate}" required><small>Jouw vaste vergoeding per gewerkte dag</small></div><div class="field"><label for="carRate">Standaard km-vergoeding in €</label><input id="carRate" name="kmRate" type="number" step="0.001" min="0" max="10" value="${s.kmRate}" required><small>Jouw eigen tarief, per kilometer</small></div></div><div class="settings-actions"><button type="submit" class="btn btn-primary">${icon('check')} Opslaan</button></div></form></section>
      <section class="panel"><h2 class="panel-title">Zo rekent de app</h2><div class="explainer"><div class="explainer-item"><strong>Netto autokosten</strong>Alle tankbeurten + alle andere uitgaven − ontvangen vergoedingen.</div><div class="explainer-item"><strong>Reiskostenvergoeding</strong>Aantal gewerkte dagen × dagtarief. Alleen geboekte vergoedingen tellen mee.</div><div class="explainer-item"><strong>Benzineverbruik</strong>Liters tussen volle tankbeurten gedeeld door gereden kilometers × 100.</div><div class="explainer-item"><strong>Kosten per kilometer</strong>Alle geboekte uitgaven gedeeld door het verschil tussen de hoogste kilometerstand en de startstand. Alleen over je geregistreerde periode.</div></div></section></div>
      <div class="stack"><section class="panel"><h2 class="panel-title">Autostatus</h2><div class="mini-divider"></div><div class="detail-kv"><span>APK vervalt</span><strong>${safe(a.text)}</strong></div><div class="detail-kv"><span>Status</span><strong class="${a.cls==='late'?'color-red':'color-green'}">${safe(a.status)}</strong></div><div class="detail-kv"><span>Geregistreerde afstand</span><strong>${distance===null?'—':`${num(distance)} km`}</strong></div><div class="detail-kv"><span>Brutokosten per km</span><strong>${costKm===null?'—':`${money(costKm)} / km`}</strong></div></section>
      <section class="panel"><div class="panel-title-row" style="margin-bottom:0"><div><h2 class="panel-title">Back-up en export</h2><p class="panel-subtitle">Bewaar een kopie van al je invoer</p></div>${icon('download')}</div><div class="backup-actions"><button type="button" class="backup-action" data-action="export-json"><span class="backup-action-left">${icon('download')}<span><strong>Back-up downloaden</strong><span>Alle gegevens, inclusief instellingen</span></span></span>${icon('chevron')}</button><button type="button" class="backup-action" data-action="import-json"><span class="backup-action-left">${icon('upload')}<span><strong>Back-up terugzetten</strong><span>Herstel je eerder opgeslagen gegevens</span></span></span>${icon('chevron')}</button><button type="button" class="backup-action" data-action="export-csv"><span class="backup-action-left">${icon('download')}<span><strong>Excel / CSV exporteren</strong><span>Alle boekingen in één overzicht</span></span></span>${icon('chevron')}</button></div><p class="muted-note">De app slaat alles lokaal op. Wis je browsergegevens of wissel je telefoon, dan kun je invoer verliezen. Download daarom regelmatig een back-up.</p></section>
      <section class="panel"><h2 class="panel-title">Gegevens beheren</h2><p class="muted-note">Wil je opnieuw beginnen? Deze actie verwijdert alle boekingen en instellingen van dit apparaat.</p><button class="btn btn-danger btn-sm" data-action="reset">${icon('trash')} Alles wissen</button></section></div></div>`;
  }
  function render(){document.querySelectorAll('[data-page]').forEach(el=>{if(el.classList.contains('nav-link')||el.classList.contains('mobile-nav-link')){el.classList.toggle('is-active',el.dataset.page===page);}});document.getElementById('breadcrumbText').textContent=PAGE_NAMES[page];document.getElementById('sideCarName').textContent=`${state.settings.make} ${state.settings.model}`;document.getElementById('sideCarSub').textContent=`${state.settings.plate?state.settings.plate+' · ':''}Bouwjaar ${state.settings.year}`;
    if(page==='dashboard')renderDashboard();else if(page==='fuel')renderFuel();else if(page==='expenses')renderExpenses();else if(page==='income')renderIncome();else renderCar();
  }
  function modalFrame(title,subtitle,body){return `<div class="modal-backdrop" data-action="backdrop"><div class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeAttribute(title)}"><div class="modal-header"><div><div class="eyebrow">${safe(subtitle)}</div><h2>${safe(title)}</h2></div><button type="button" class="btn-plain" data-action="close" aria-label="Sluiten">${icon('close')}</button></div>${body}</div></div>`;}
  function chooser(){editing=null;modalRoot.innerHTML=modalFrame('Wat wil je toevoegen?','NIEUWE BOEKING',`<div class="modal-form"><div class="choice-grid"><button class="choice-card" data-action="add" data-kind="fuel">${icon('fuel')} Tankbeurt</button><button class="choice-card" data-action="add" data-kind="expense">${icon('wrench')} Uitgave</button><button class="choice-card" data-action="add" data-kind="income">${icon('road')} Vergoeding</button></div><button type="button" class="btn btn-soft btn-full" data-action="close">Annuleren</button></div>`);}
  function field(id,label,value='',type='text',attrs=''){return `<div class="field"><label for="${id}">${safe(label)}</label><input id="${id}" name="${id}" type="${type}" value="${escapeAttribute(value)}" ${attrs}></div>`;}
  function choiceType(type){return `<div class="field" style="margin-bottom:15px"><label for="reimbType">Soort vergoeding</label><select id="reimbType" name="type"><option value="day" ${type==='day'?'selected':''}>Reiskostenvergoeding per gewerkte dag</option><option value="km" ${type==='km'?'selected':''}>Kilometervergoeding, bedrag per km</option><option value="fuel" ${type==='fuel'?'selected':''}>Benzinevergoeding, vast bedrag</option></select></div>`;}
  function editModal(kind,id){
    editing=id||null;
    let data=id?state.entries.find(e=>e.id===id):null;
    if(id&&!data){notify('Deze boeking is niet gevonden.');return;}
    if(data)kind=data.kind;
    const e=data||{date:localDate(),kind,total:'',liters:'',odometer:'',fullTank:true,station:'',category:'reparatie',description:'',notes:'',type:'day',distance:'',days:'',rate:state.settings.dayRate};
    const title=kind==='fuel'?'Tankbeurt':kind==='expense'?'Uitgave':'Vergoeding';
    let body='';
    if(kind==='fuel')body=`<div class="field-grid">${field('date','Datum',e.date,'date','required')}${field('odometer','Kilometerstand',e.odometer,'number','min="0" step="1" placeholder="Bijv. 183200"')}${field('liters','Getankte liters',e.liters||'','number','required min="0.01" step="0.001" placeholder="Bijv. 42,5"')}${field('total','Totaal betaald in €',e.total||'','number','required min="0" step="0.01" placeholder="Bijv. 82,50"')}</div><div class="form-options"><input id="fullTank" name="fullTank" type="checkbox" ${e.fullTank?'checked':''}><label for="fullTank">Tank volledig gevuld</label></div><div class="field">${field('station','Tankstation of omschrijving',e.station,'text','maxlength="160" placeholder="Bijv. Shell Leende"')}</div><div class="computed-box"><span>Prijs per liter</span><strong id="fuelPreview">—</strong></div>`;
    else if(kind==='expense')body=`<div class="field-grid">${field('date','Datum',e.date,'date','required')}<div class="field"><label for="category">Categorie</label><select id="category" name="category">${Object.entries(CATEGORIES).map(([k,v])=>`<option value="${k}" ${e.category===k?'selected':''}>${safe(v)}</option>`).join('')}</select></div></div><div class="field-grid">${field('total','Bedrag in €',e.total||'','number','required min="0" step="0.01"')}${field('odometer','Kilometerstand (optioneel)',e.odometer,'number','min="0" step="1"')}</div><div class="field" style="margin-bottom:15px">${field('description','Omschrijving',e.description,'text','required maxlength="160" placeholder="Bijv. Nieuwe remblokken"')}</div><div class="field"><label for="notes">Notities (optioneel)</label><textarea id="notes" name="notes" maxlength="400" placeholder="Garage, bonnummer of bijzonderheden">${safe(e.notes)}</textarea></div>`;
    else body=`<div class="field-grid">${field('date','Datum ontvangst',e.date,'date','required')}${field('description','Omschrijving',e.description,'text','maxlength="160" placeholder="Bijv. Woon-werk oktober"')}</div>${choiceType(e.type)}<div id="reimbDynamic"></div><div class="computed-box"><span>Ontvangen vergoeding</span><strong id="incomePreview">—</strong></div><p class="form-hint">Deze vergoeding wordt afgetrokken van je totale autokosten.</p>`;
    modalRoot.innerHTML=modalFrame(data?`${title} bewerken`:`${title} toevoegen`,data?'BOEKING WIJZIGEN':'NIEUWE BOEKING',`<form class="modal-form" id="entryForm" data-kind="${kind}">${body}<div class="modal-footer"><button type="button" class="btn btn-soft" data-action="close">Annuleren</button><button class="btn btn-primary" type="submit">${icon('check')} ${data?'Wijzigingen opslaan':'Opslaan'}</button></div></form>`);
    if(kind==='income')renderIncomeFields(e);
    updateModalPreview();
    const first=modalRoot.querySelector('input,select');first?.focus();
  }
  function renderIncomeFields(entry=null){
    const select=modalRoot.querySelector('#reimbType');if(!select)return;
    const type=select.value,oldDist=modalRoot.querySelector('#distance')?.value,oldDays=modalRoot.querySelector('#days')?.value,oldAmount=modalRoot.querySelector('#total')?.value;
    const target=modalRoot.querySelector('#reimbDynamic');
    const oldRate=target.dataset.currentType===type?modalRoot.querySelector('#rate')?.value:undefined;target.dataset.currentType=type;
    if(type==='day')target.innerHTML=`<div class="field-grid">${field('days','Aantal gewerkte dagen',oldDays??(entry?.type==='day'?entry?.days:'')??'','number','required min="1" max="366" step="1" placeholder="Bijv. 20"')}${field('rate','Vergoeding per dag in €',oldRate??(entry?.type==='day'?entry?.rate:state.settings.dayRate),'number','required min="0" max="1000" step="0.01"')}</div>`;
    else if(type==='km')target.innerHTML=`<div class="field-grid">${field('distance','Aantal kilometers',oldDist??entry?.distance??'','number','required min="0" step="0.1" placeholder="Bijv. 720"')}${field('rate','Vergoeding per km in €',oldRate??entry?.rate??state.settings.kmRate,'number','required min="0" max="10" step="0.001"')}</div>`;
    else target.innerHTML=`<div class="field-grid">${field('total','Ontvangen bedrag in €',oldAmount??(entry?.type==='fuel'?entry?.total:'')??'','number','required min="0" step="0.01"')}${field('distance','Afstand in km (optioneel)',oldDist??entry?.distance??'','number','min="0" step="0.1"')}</div>`;
    updateModalPreview();
  }
  function updateModalPreview(){
    let p=modalRoot.querySelector('#fuelPreview');if(p){const liters=nn(modalRoot.querySelector('#liters')?.value),cost=nn(modalRoot.querySelector('#total')?.value);p.textContent=liters>0?`${money(cost/liters)} / l`:'—';}
    p=modalRoot.querySelector('#incomePreview');if(p){const type=modalRoot.querySelector('#reimbType')?.value;if(type==='day'){const days=nn(modalRoot.querySelector('#days')?.value),r=nn(modalRoot.querySelector('#rate')?.value);p.textContent=money(days*r);}else if(type==='km'){const d=nn(modalRoot.querySelector('#distance')?.value),r=nn(modalRoot.querySelector('#rate')?.value);p.textContent=money(d*r);}else{p.textContent=money(nn(modalRoot.querySelector('#total')?.value));}}
  }
  function formValue(form,name){return form.elements.namedItem(name)?.value??'';}
  function saveEntry(form){
    const kind=form.dataset.kind;
    const date=formValue(form,'date');if(!isDate(date)){notify('Vul een geldige datum in.');return;}
    const old=editing?state.entries.find(e=>e.id===editing):null;
    const e={id:old?.id||randomId(),kind,date,odometer:formValue(form,'odometer')===''?'':nn(formValue(form,'odometer')),liters:0,total:0,fullTank:false,station:'',category:'overig',description:'',notes:'',type:'km',distance:0,days:0,rate:0};
    if(kind==='fuel'){
      e.liters=nn(formValue(form,'liters'));e.total=amount(formValue(form,'total'));e.fullTank=Boolean(form.elements.namedItem('fullTank')?.checked);e.station=str(formValue(form,'station'));
      if(e.liters<=0){notify('Vul het aantal getankte liters in.');return;}
    }else if(kind==='expense'){
      e.category=CATEGORIES[formValue(form,'category')]?formValue(form,'category'):'overig';e.total=amount(formValue(form,'total'));e.description=str(formValue(form,'description'));e.notes=str(formValue(form,'notes'),400);
      if(!e.description){notify('Vul een omschrijving in.');return;}
    }else if(kind==='income'){
      e.type=['day','km','fuel'].includes(formValue(form,'type'))?formValue(form,'type'):'day';e.description=str(formValue(form,'description'));e.distance=nn(formValue(form,'distance'));e.days=nn(formValue(form,'days'));
      if(e.type==='day'){e.rate=nn(formValue(form,'rate'));if(!Number.isInteger(e.days)||e.days<1||e.days>366||e.rate>1000){notify('Vul een geldig aantal werkdagen en dagtarief in.');return;}e.total=amount(e.days*e.rate);}
      else if(e.type==='km'){e.rate=nn(formValue(form,'rate'));e.total=amount(e.distance*e.rate);if(e.distance<=0){notify('Vul het aantal kilometers in.');return;}}
      else{e.total=amount(formValue(form,'total'));}
    }
    if(old){const idx=state.entries.findIndex(x=>x.id===old.id);state.entries[idx]=e;}else state.entries.push(e);
    if(persist()){modalRoot.innerHTML='';editing=null;render();notify(old?'Boeking aangepast':'Boeking opgeslagen');}
  }
  function saveSettings(form){const s=state.settings;const year=str(formValue(form,'year'),4);if(!/^(19|20)\d\d$/.test(year)){notify('Vul een geldig bouwjaar in.');return;}const rate=nn(formValue(form,'kmRate'));if(rate>10){notify('De vergoeding mag maximaal € 10 per kilometer zijn.');return;}
    s.make=str(formValue(form,'make'),40)||'Ford';s.model=str(formValue(form,'model'),50)||'Focus';s.year=year;s.plate=str(formValue(form,'plate'),20).toUpperCase();s.startOdometer=formValue(form,'startOdometer')===''?'':nn(formValue(form,'startOdometer'));s.apkDate=isDate(formValue(form,'apkDate'))?formValue(form,'apkDate'):'';s.kmRate=rate;s.dayRate=nn(formValue(form,'dayRate'));if(s.dayRate>1000){notify('Vul een dagtarief onder € 1000 in.');return;}
    if(persist()){render();notify('Autogegevens opgeslagen');}
  }
  function deleteEntry(id){const e=state.entries.find(x=>x.id===id);if(!e)return;if(!window.confirm(`Wil je deze boeking verwijderen?\n\n${activityName(e)} · ${money(e.total)}`))return;state.entries=state.entries.filter(x=>x.id!==id);if(persist()){render();notify('Boeking verwijderd');}}
  function downloadFile(name,contents,mime){const blob=new Blob([contents],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
  function exportJSON(){downloadFile(`focus-autokosten-backup-${localDate()}.json`,JSON.stringify(state,null,2),'application/json;charset=utf-8');notify('Back-up gedownload');}
  function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`;}
  function exportCSV(){const header=['Datum','Soort','Categorie','Omschrijving','Gewerkte dagen','Kilometers rit','Tarief vergoeding','Liters','Kilometerstand','Volle tank','Uitgaven EUR','Vergoeding EUR','Notities'];const rows=allEntries().map(e=>[e.date,e.kind==='fuel'?'Tankbeurt':e.kind==='expense'?'Uitgave':'Vergoeding',e.kind==='expense'?CATEGORIES[e.category]:e.kind==='income'?(e.type==='day'?'Vergoeding werkdagen':e.type==='km'?'Kilometervergoeding':'Benzinevergoeding'):'Benzine',e.kind==='fuel'?e.station:e.description,e.kind==='income'&&e.type==='day'?e.days:'',e.kind==='income'&&e.type==='km'?e.distance:'',e.kind==='income'&&['day','km'].includes(e.type)?e.rate:'',e.kind==='fuel'?e.liters:'',e.odometer,e.kind==='fuel'?(e.fullTank?'Ja':'Nee'):'',e.kind!=='income'?e.total:'',e.kind==='income'?e.total:'',e.notes]);const csv='\ufeff'+[header,...rows].map(row=>row.map(v=>csvCell(typeof v==='number'?String(v).replace('.',','):v)).join(';')).join('\r\n');downloadFile(`focus-autokosten-${localDate()}.csv`,csv,'text/csv;charset=utf-8');notify('CSV-bestand gedownload');}
  async function importJSON(file){try{if(file.size>8_000_000)throw Error('Het gekozen bestand is te groot.');const next=normalizeState(JSON.parse(await file.text()));if(!window.confirm(`Back-up terugzetten?\n\nJe huidige ${state.entries.length} boekingen worden vervangen door ${next.entries.length} boekingen uit de back-up.`))return;const old=state;state=next;if(persist()){page='dashboard';period='all';modalRoot.innerHTML='';render();notify('Back-up teruggezet');}else{state=old;}}catch(err){notify(err.message||'Back-up kon niet worden gelezen.');}}
  function resetAll(){if(!window.confirm('Weet je zeker dat je alle boekingen en autogegevens wilt wissen? Deze actie kun je niet ongedaan maken.'))return;if(!window.confirm('Laatste controle. Heb je een back-up gemaakt? Klik op OK om alles te wissen.'))return;state=defaultState();if(persist()){page='dashboard';period='all';render();notify('Gegevens gewist');}}
  function filterRecords(value){const rows=[...document.querySelectorAll('#recordsBody tr')];let count=0;const q=value.trim().toLocaleLowerCase('nl-NL');for(const row of rows){const show=(row.dataset.search||'').toLocaleLowerCase('nl-NL').includes(q);row.hidden=!show;if(show)count++;}const label=document.getElementById('recordCount');if(label)label.textContent=`${count} ${count===1?'boeking':'boekingen'}`;const no=document.getElementById('noSearchResults');if(no)no.style.display=count?'none':'block';}
  document.addEventListener('click',event=>{
    const nav=event.target.closest('[data-page]');if(nav){page=nav.dataset.page;render();window.scrollTo({top:0,behavior:'instant'});return;}
    const element=event.target.closest('[data-action]');if(!element)return;const action=element.dataset.action;
    if(action==='backdrop'&&event.target===element){modalRoot.innerHTML='';editing=null;return;}
    if(action==='close'){modalRoot.innerHTML='';editing=null;return;}
    if(action==='add'){editModal(element.dataset.kind);return;}
    if(action==='edit'){editModal('',element.dataset.id);return;}
    if(action==='delete'){deleteEntry(element.dataset.id);return;}
    if(action==='export-json'){exportJSON();return;}
    if(action==='export-csv'){exportCSV();return;}
    if(action==='import-json'){document.getElementById('importFile').click();return;}
    if(action==='reset'){resetAll();return;}
  });
  document.addEventListener('click',event=>{const btn=event.target.closest('[data-period]');if(btn){period=btn.dataset.period;render();}});
  document.addEventListener('input',event=>{if(event.target.id==='recordSearch')filterRecords(event.target.value);if(event.target.closest('#entryForm'))updateModalPreview();});
  document.addEventListener('change',event=>{if(event.target.id==='reimbType')renderIncomeFields();if(event.target.id==='importFile'){const file=event.target.files?.[0];if(file)importJSON(file);event.target.value='';}});
  document.addEventListener('submit',event=>{if(event.target.id==='entryForm'){event.preventDefault();saveEntry(event.target);}if(event.target.id==='settingsForm'){event.preventDefault();saveSettings(event.target);}});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&modalRoot.innerHTML){modalRoot.innerHTML='';editing=null;}});
  document.getElementById('newEntryTop').addEventListener('click',chooser);
  render();
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol))navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
})();
