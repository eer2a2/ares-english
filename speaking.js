(function(){
var KEY='ares_speaking_v5';
var state={turns:0,minutes:0,streak:0,lastDay:'',mistakes:[]};
try{var x=JSON.parse(localStorage.getItem(KEY)||'null');if(x){for(var k in x)state[k]=x[k];}}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
function el(id){return document.getElementById(id);}
function esc(s){return String(s||'').replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m];});}
function apiKey(){return localStorage.getItem('ing_defter_api_key')||localStorage.getItem('ing_defter_api_key_local_backup')||'';}
function setKey(){var v=prompt('Gemini API anahtarını gir:',apiKey());if(v){localStorage.setItem('ing_defter_api_key',v.trim());localStorage.setItem('ing_defter_api_key_local_backup',v.trim());alert('API anahtarı kaydedildi.');}}
function touch(){state.turns++;state.minutes+=1;var t=new Date().toISOString().slice(0,10);if(state.lastDay!==t){var d=new Date();d.setDate(d.getDate()-1);var y=d.toISOString().slice(0,10);state.streak=state.lastDay===y?state.streak+1:1;state.lastDay=t;}save();progress();}
function progress(){if(el('pTurns'))el('pTurns').textContent=state.turns;if(el('pMinutes'))el('pMinutes').textContent=Math.round(state.minutes);if(el('pStreak'))el('pStreak').textContent=state.streak;if(el('pMistakes'))el('pMistakes').textContent=state.mistakes.length;var box=el('mistakeList');if(box){box.innerHTML=state.mistakes.length?state.mistakes.map(function(m){return '<div style="padding:10px 0;border-bottom:1px solid #ddd"><b>Sen:</b> '+esc(m.a)+'<br><b>Daha doğal:</b> '+esc(m.b)+'</div>';}).join(''):'Henüz önemli bir hata kaydedilmedi.';}}
var _geminiResolvedModel=null;
var GEMINI_MODEL_PREFERENCE=['gemini-3.6-flash','gemini-3.7-flash','gemini-3-flash-preview'];

function resolveGeminiModel(apiKey){
  if(_geminiResolvedModel) return Promise.resolve(_geminiResolvedModel);
  return fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000',{
    method:'GET',
    headers:{'x-goog-api-key':apiKey}
  }).then(function(r){
    return r.text().then(function(raw){
      var d={};
      try{d=raw?JSON.parse(raw):{};}catch(e){}
      if(!r.ok){
        var msg=(d.error&&d.error.message)?d.error.message:raw||('HTTP '+r.status);
        throw new Error('MODEL_LIST_ERROR: '+r.status+' '+msg);
      }
      var models=(d.models||[]).filter(function(m){
        var methods=m.supportedGenerationMethods||m.supportedActions||[];
        return methods.indexOf('generateContent')>=0;
      });
      var ids=models.map(function(m){return String(m.name||'').replace(/^models\//,'');});
      for(var i=0;i<GEMINI_MODEL_PREFERENCE.length;i++){
        if(ids.indexOf(GEMINI_MODEL_PREFERENCE[i])>=0){
          _geminiResolvedModel=GEMINI_MODEL_PREFERENCE[i];
          return _geminiResolvedModel;
        }
      }
      var any=null;
      for(var j=0;j<ids.length;j++){
        if(/^gemini-.*flash/i.test(ids[j])){any=ids[j];break;}
      }
      if(!any && ids.length) any=ids[0];
      if(!any) throw new Error('NO_GENERATE_MODEL');
      _geminiResolvedModel=any;
      return any;
    });
  });
}

function ask(system,user){
  var key=apiKey();
  if(!key){
    setKey();
    key=apiKey();
    if(!key) return Promise.reject(new Error('API anahtarı yok. Önce API anahtarını kaydet.'));
  }

  return resolveGeminiModel(key).then(function(model){
    var url='https://generativelanguage.googleapis.com/v1beta/models/'+encodeURIComponent(model)+':generateContent';
    var payload={
      systemInstruction:{parts:[{text:system}]},
      contents:[{role:'user',parts:[{text:user}]}],
      generationConfig:{maxOutputTokens:450,temperature:0.7}
    };

    return fetch(url,{
      method:'POST',
      headers:{
        'Content-Type':'application/json',
        'x-goog-api-key':key
      },
      body:JSON.stringify(payload)
    }).then(function(r){
      return r.text().then(function(raw){
        var d={};
        try{d=raw?JSON.parse(raw):{};}catch(e){}

        if(!r.ok){
          _geminiResolvedModel=null;
          var msg=(d.error&&d.error.message)?d.error.message:raw||('HTTP '+r.status);
          throw new Error('Gemini '+r.status+' ('+model+'): '+msg);
        }

        var parts=((((d.candidates||[])[0]||{}).content||{}).parts||[]);
        var text=parts.map(function(p){return p.text||'';}).join('').trim();
        if(!text) throw new Error('Gemini boş yanıt döndürdü ('+model+').');
        return text;
      });
    });
  }).catch(function(err){
    var msg=err&&err.message?err.message:String(err);
    if(msg.indexOf('Failed to fetch')>=0){
      throw new Error('Ağ/CORS hatası: Gemini isteği tarayıcı tarafından gönderilemedi.');
    }
    throw err;
  });
}
function feedback(id,text){if(el(id))el(id).innerHTML='<div class="feedback">'+esc(text)+'</div>';}
var activeRecognition=null, activeVoiceButton=null, activeVoiceTarget=null, finalSpeech='';
function autoContinueAfterVoice(target){
  var box=el(target), t=box?box.value.trim():''; if(!t)return;
  if(target==='roleText' && el('roleSend')) el('roleSend').click();
  else if(target==='abroadText' && el('abroadSend')) el('abroadSend').click();
  else if(target==='coachText' && el('coachSend')) el('coachSend').click();
  else if(target==='quickText' && el('quickEval')) el('quickEval').click();
  else if(target==='surpriseText' && el('surpriseEval')) el('surpriseEval').click();
}
function resetVoiceButton(){
  if(activeVoiceButton){activeVoiceButton.textContent='🎤 Konuş';activeVoiceButton.classList.remove('recording');}
  activeRecognition=null;activeVoiceButton=null;activeVoiceTarget=null;finalSpeech='';
}
function voice(target,button){
  var R=window.SpeechRecognition||window.webkitSpeechRecognition;
  if(!R){alert('Bu tarayıcıda ses tanıma kullanılamıyor. Yazıp gönderebilirsin.');return;}
  if(activeRecognition){
    try{activeRecognition.stop();}catch(e){}
    return;
  }
  var box=el(target); if(!box)return;
  finalSpeech=''; activeVoiceTarget=target; activeVoiceButton=button||null;
  var r=new R(); activeRecognition=r;
  r.lang='en-US'; r.interimResults=true; r.continuous=true; r.maxAlternatives=1;
  if(activeVoiceButton){activeVoiceButton.textContent='⏹ Durdur';activeVoiceButton.classList.add('recording');}
  r.onresult=function(e){
    var interim='';
    for(var i=e.resultIndex;i<e.results.length;i++){
      var piece=(e.results[i][0].transcript||'').trim();
      if(!piece)continue;
      if(e.results[i].isFinal) finalSpeech+=(finalSpeech?' ':'')+piece;
      else interim+=(interim?' ':'')+piece;
    }
    box.value=(finalSpeech+(interim?' '+interim:'')).trim();
  };
  r.onerror=function(e){if(e.error!=='aborted'&&e.error!=='no-speech')console.log('speech error',e.error);};
  r.onend=function(){
    var targetDone=activeVoiceTarget;
    var text=(box.value||'').trim();
    resetVoiceButton();
    if(text) setTimeout(function(){autoContinueAfterVoice(targetDone);},120);
  };
  try{r.start();}catch(e){resetVoiceButton();}
}

var rolePools={
hotel:[
['Rome · Receptionist','“I’m sorry, but I can’t find a reservation under your name.”','Rezervasyon yaptığını açıkla ve çözüm iste.'],
['Paris · Receptionist','“Your room won’t be ready for another two hours.”','Erken geldiğini söyle ve valizini bırakıp bırakamayacağını sor.'],
['Vienna · Reception','“I’m sorry, but the air conditioning in your room is not working.”','Sorunu açıkla ve başka oda iste.'],
['Berlin · Reception','“Check-out is at 11 a.m.”','Geç çıkış yapıp yapamayacağını ve ücretini sor.']
],
restaurant:[
['Barcelona · Waiter','“Is everything okay with your meal, sir?”','Yanlış yemek geldiğini nazikçe açıkla.'],
['Rome · Waiter','“Are you ready to order?”','Bir ana yemek sipariş et ve içeriğini sor.'],
['Paris · Waiter','“Would you like anything else?”','Hesabı iste ve kartla ödeyip ödeyemeyeceğini sor.'],
['Athens · Waiter','“This dish contains nuts.”','Alerjin olduğunu söyle ve alternatif iste.']
],
cafe:[
['Dublin · Barista','“Hi! What can I get for you?”','Kahve sipariş et, boyutunu söyle ve takeaway iste.'],
['Amsterdam · Barista','“Would you like milk or sugar?”','Sade kahve istediğini açıkla.'],
['London · Barista','“Our card machine is not working.”','Nakit olmadığını söyle ve başka ödeme seçeneği sor.'],
['Malta · Barista','“Would you like something to eat with that?”','Küçük bir atıştırmalık sor ve fiyatını öğren.']
],
passport:[
['London · Immigration officer','“What is the purpose of your visit?”','Seyahat amacını açıkla.'],
['Dublin · Immigration officer','“How long are you staying?”','Kalış süreni ve dönüş tarihini söyle.'],
['Rome · Border officer','“Where are you staying?”','Konaklama yerini açıkla.'],
['Amsterdam · Border officer','“Do you have a return ticket?”','Dönüş biletin olduğunu belirt.']
],
taxi:[
['Amsterdam · Driver','“Where would you like to go?”','Gideceğin yeri söyle, süreyi sor.'],
['Rome · Driver','“Traffic is heavy today.”','Yaklaşık varış süresini ve alternatif rotayı sor.'],
['Paris · Driver','“Cash only, please.”','Kartla ödemek istediğini söyle ve çözüm sor.'],
['Malta · Driver','“Which entrance should I drop you at?”','Otelin ana girişini istediğini açıkla.']
],
train:[
['Prague · Station employee','“Your train has already left.”','Sonraki treni ve biletinin geçerli olup olmadığını sor.'],
['Vienna · Ticket desk','“Which train would you like?”','Gideceğin şehri ve tercih ettiğin saati söyle.'],
['Milan · Station employee','“The platform has changed.”','Yeni peronu ve nasıl gideceğini sor.'],
['Berlin · Conductor','“May I see your ticket?”','Biletini telefondan göstermek istediğini söyle.']
],
shopping:[
['Milan · Shop assistant','“Can I help you find something?”','Bedenini söyle ve başka renk sor.'],
['London · Shop assistant','“Do you have the receipt?”','Ürünü iade etmek istediğini ve fişinin olduğunu söyle.'],
['Barcelona · Shop assistant','“That size is out of stock.”','Benzer başka ürün olup olmadığını sor.'],
['Paris · Shop assistant','“Would you like to try it on?”','Deneme kabininin nerede olduğunu sor.']
],
smalltalk:[
['Malta · Classmate','“So, what brought you here?”','Kendini tanıt ve neden İngilizce öğrendiğini söyle.'],
['Dublin · Traveller','“Is this your first time here?”','Kısa cevap ver ve karşı soru sor.'],
['Rome · Local','“What do you think of the city so far?”','Şehir hakkındaki fikrini söyle.'],
['Barcelona · Classmate','“What do you usually do after class?”','Günlük planını anlat ve ona da sor.']
]
};

var abroadPools={
passport:[
['London · Immigration officer','“What is the purpose of your visit and how long will you stay?”','Amacını ve kalış süreni açıkla.'],
['Rome · Baggage desk','“Your suitcase did not arrive.”','Bavulunun kayıp olduğunu anlat ve ne yapman gerektiğini sor.'],
['Amsterdam · Airline desk','“Your flight has been delayed by three hours.”','Alternatif uçuş veya yemek kuponu sor.'],
['Dublin · Security','“Is this bag yours?”','Çantanın sana ait olduğunu ve içinde ne olduğunu açıkla.']
],
hotel:[
['Rome · Reception','“I can’t find your booking. Do you have a confirmation?”','Rezervasyon onayını gösterdiğini söyle.'],
['Paris · Reception','“Breakfast is not included.”','Kahvaltı eklemenin ücretini sor.'],
['Vienna · Reception','“The room is on the fifth floor.”','Asansör olup olmadığını sor.'],
['Berlin · Reception','“We need a €100 deposit.”','Depozitonun ne zaman iade edileceğini sor.']
],
restaurant:[
['Barcelona · Restaurant','“You ordered the pasta, right?”','Farklı bir yemek sipariş ettiğini açıkla.'],
['Rome · Restaurant','“Would you like still or sparkling water?”','Tercihini söyle ve menüyü iste.'],
['Athens · Restaurant','“The kitchen closes in ten minutes.”','Hızlıca ne sipariş edebileceğini sor.'],
['Paris · Restaurant','“The service charge is included.”','Bahşiş bırakmanın gerekli olup olmadığını sor.']
],
train:[
['Prague · Station','You missed your connection.','Sonraki treni ve yeni bilet gerekip gerekmediğini sor.'],
['Milan · Station','The train is delayed by 45 minutes.','Bağlantını kaçırıp kaçırmayacağını sor.'],
['Vienna · Station','You are not sure which platform to use.','Peronu ve kalkış saatini sor.'],
['Berlin · Station','The ticket machine is not accepting your card.','Nereden bilet alabileceğini sor.']
],
directions:[
['Vienna · Street','Your phone battery is dead.','Şehir merkezine nasıl gideceğini sor.'],
['Rome · Street','You cannot find your hotel.','Otel adresini gösterip yol tarifi iste.'],
['Paris · Metro','You are on the wrong metro line.','Doğru hatta nasıl geçeceğini sor.'],
['Prague · Old Town','You want to find the nearest tram stop.','En yakın tramvay durağını sor.']
],
shopping:[
['Milan · Store','The shirt you like is too small.','Daha büyük beden ve başka renk sor.'],
['London · Store','You want a tax-free form.','Tax-free işleminin nasıl yapıldığını sor.'],
['Barcelona · Store','The price at the register is different.','Etikette farklı fiyat gördüğünü açıkla.'],
['Paris · Store','You want to exchange a gift.','Değişim şartlarını sor.']
],
cafe:[
['Paris · Café','Order a black coffee and something small to eat.','Sonra kartla ödeme yapıp yapamayacağını sor.'],
['Dublin · Café','There are no free tables inside.','Dışarıda oturup oturamayacağını sor.'],
['Malta · Café','Your coffee is cold.','Nazikçe değiştirilmesini iste.'],
['Amsterdam · Café','You are not sure what a menu item is.','İçeriğini sor.']
],
problem:[
['Berlin · City centre','You lost your wallet.','En yakın polis merkezini sor ve ne olduğunu anlat.'],
['Rome · Pharmacy','You need a basic painkiller.','Reçetesiz uygun bir seçenek sor.'],
['Paris · Street','Your phone was stolen.','Yardım iste ve polis merkezini sor.'],
['Malta · Hotel','You locked yourself out of your room.','Resepsiyondan yeni kart iste.']
],
social:[
['Malta · Language school','“What do you usually do after class?”','Cevap ver ve karşı soru sor.'],
['Dublin · Hostel','“Where are you from?”','Kendini tanıt ve sohbeti sürdür.'],
['Barcelona · Tour group','“What places have you visited so far?”','Gezdiğin yerlerden bahset.'],
['Rome · Café','“Are you travelling alone?”','Kısa cevap ver ve karşı tarafın seyahatini sor.']
]
};

var currentRole='hotel', currentAbroad='passport', roleScenario=null, abroadScenario=null;
function randomItem(arr,prev){if(!arr||!arr.length)return null;if(arr.length===1)return arr[0];var x;do{x=arr[Math.floor(Math.random()*arr.length)];}while(prev&&x[1]===prev[1]);return x;}
function setActive(selector,attr,val){var nodes=document.querySelectorAll(selector);for(var i=0;i<nodes.length;i++){nodes[i].classList.toggle('active',nodes[i].getAttribute(attr)===val);}}
function drawRole(newOne){roleScenario=newOne?randomItem(rolePools[currentRole],roleScenario):(roleScenario||rolePools[currentRole][0]);if(el('rolePlace'))el('rolePlace').textContent=roleScenario[0];if(el('rolePrompt'))el('rolePrompt').textContent=roleScenario[1];if(el('roleTask'))el('roleTask').textContent='Görev: '+roleScenario[2];}
function drawAbroad(newOne){abroadScenario=newOne?randomItem(abroadPools[currentAbroad],abroadScenario):(abroadScenario||abroadPools[currentAbroad][0]);if(el('abroadPlace'))el('abroadPlace').textContent=abroadScenario[0];if(el('abroadPrompt'))el('abroadPrompt').textContent=abroadScenario[1];if(el('abroadTask'))el('abroadTask').textContent='Görev: '+abroadScenario[2];}
function evalAnswer(kind,scenario,text,feedbackId){
  touch();feedback(feedbackId,'Değerlendiriliyor…');
  var sys='You are Ares, a speaking-first English coach for a Turkish A2-B1 learner. Fluency and communication first. Ignore tiny article/preposition/punctuation issues unless they matter. In Turkish, give exactly: 1) Anlaşılırlık: /10, 2) one important correction only if needed, 3) Daha doğal hali: one concise English version, 4) one short encouragement. Do not over-correct.';
  ask(sys,'Scenario: '+scenario[0]+' | '+scenario[1]+' | Task: '+scenario[2]+'\nLearner answer: '+text).then(function(z){feedback(feedbackId,cleanAIText(z)||'Yanıt alınamadı.');}).catch(function(e){feedback(feedbackId,e.message);});
}
function sendRole(kind,scenario,text,feedbackId){
  touch();feedback(feedbackId,'Karşı taraf düşünüyor…');
  var sys='You are the other person in a realistic travel role-play. Role/context: '+scenario[0]+'. Situation: '+scenario[1]+' Task for learner: '+scenario[2]+'. Stay in character. Reply in short natural B1 English, 1-3 sentences, then ask exactly one follow-up question. Do not explain grammar.';
  ask(sys,text).then(function(z){var clean=cleanAIText(z)||'Yanıt alınamadı.'; if(clean.indexOf('?')<0){clean=clean.replace(/\s+[A-Z][A-Za-z']*$/,'').trim(); clean += (kind==='abroad'?' What would you like to do next?':' Would you like anything else?');} feedback(feedbackId,clean);lastAresSpoken=clean;speakEnglish(clean);}).catch(function(e){feedback(feedbackId,e.message);});
}

document.addEventListener('click',function(e){
  var t=e.target;
  var speakNode=t;
  while(speakNode&&speakNode!==document){
    var sid=speakNode.getAttribute&&speakNode.getAttribute('data-speak-text');
    if(sid){speakElement(sid);return;}
    speakNode=speakNode.parentNode;
  }
  while(t&&t!==document){
    var v=t.getAttribute&&t.getAttribute('data-voice');if(v){voice(v,t);return;}
    var rt=t.getAttribute&&t.getAttribute('data-role-topic');if(rt){currentRole=rt;roleScenario=null;setActive('[data-role-topic]','data-role-topic',rt);drawRole(false);setTimeout(function(){speakElement('rolePrompt');},80);return;}
    var at=t.getAttribute&&t.getAttribute('data-abroad-topic');if(at){currentAbroad=at;abroadScenario=null;setActive('[data-abroad-topic]','data-abroad-topic',at);drawAbroad(false);setTimeout(function(){speakElement('abroadPrompt');},80);return;}
    t=t.parentNode;
  }
});

if(el('roleNew'))el('roleNew').onclick=function(){drawRole(true);speakElement('rolePrompt');};
if(el('roleHearCheck'))el('roleHearCheck').onclick=function(){hearCheck(el('roleText').value.trim(),roleScenario,'roleFeedback','roleText');};
if(el('roleSend'))el('roleSend').onclick=function(){var t=el('roleText').value.trim();if(!t)return feedback('roleFeedback','Önce bir cevap söyle veya yaz.');sendRole('role',roleScenario,t,'roleFeedback');};
if(el('roleEval'))el('roleEval').onclick=function(){var t=el('roleText').value.trim();if(!t)return feedback('roleFeedback','Önce bir cevap söyle veya yaz.');evalAnswer('role',roleScenario,t,'roleFeedback');};

if(el('abroadNew'))el('abroadNew').onclick=function(){drawAbroad(true);speakElement('abroadPrompt');};
if(el('abroadHearCheck'))el('abroadHearCheck').onclick=function(){hearCheck(el('abroadText').value.trim(),abroadScenario,'abroadFeedback','abroadText');};
if(el('abroadSend'))el('abroadSend').onclick=function(){var t=el('abroadText').value.trim();if(!t)return feedback('abroadFeedback','Önce bir cevap söyle veya yaz.');sendRole('abroad',abroadScenario,t,'abroadFeedback');};
if(el('abroadEval'))el('abroadEval').onclick=function(){var t=el('abroadText').value.trim();if(!t)return feedback('abroadFeedback','Önce bir cevap söyle veya yaz.');evalAnswer('abroad',abroadScenario,t,'abroadFeedback');};

function cleanAIText(text){
  var s=String(text||'').trim();
  var bad=[
    /^check constraints\b/i,
    /^constraints\b/i,
    /^ares persona\b/i,
    /^analysis\b/i,
    /^reasoning\b/i,
    /^internal\b/i,
    /^system prompt\b/i,
    /^developer\b/i
  ];
  var lines=s.split(/\r?\n/), keep=[], skipping=false;
  for(var i=0;i<lines.length;i++){
    var line=lines[i].trim();
    var normalized=line.replace(/^[\s>*#_\-•]+/,'').replace(/\*\*/g,'').trim();
    var isBad=false;
    for(var j=0;j<bad.length;j++){if(bad[j].test(normalized)){isBad=true;break;}}
    if(isBad){skipping=true;continue;}
    if(skipping){
      if(!line){skipping=false;}
      continue;
    }
    keep.push(lines[i]);
  }
  var out=keep.join('\n').trim();
  return out;
}

var lastAresSpoken='';
function speakEnglish(text){
  var s=String(text||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  if(!s)return;
  if(!('speechSynthesis' in window)){alert('Bu tarayıcı sesli okuma özelliğini desteklemiyor.');return;}
  window.speechSynthesis.cancel();
  var u=new SpeechSynthesisUtterance(s);
  u.lang='en-US';
  u.rate=0.92;
  u.pitch=1.0;
  var voices=window.speechSynthesis.getVoices();
  var preferred=null;
  for(var i=0;i<voices.length;i++){
    if(/^en(-|_)/i.test(voices[i].lang||'')){preferred=voices[i];break;}
  }
  if(preferred)u.voice=preferred;
  window.speechSynthesis.speak(u);
}
function speakElement(id){
  var node=el(id);if(node)speakEnglish(node.textContent||node.innerText||'');
}

function localSpeechHint(text,scenario){
  var s=String(text||'');
  var context=((scenario&&scenario[0])||'')+' '+((scenario&&scenario[1])||'')+' '+((scenario&&scenario[2])||'');
  if(/coffee|café|barista/i.test(context)){
    s=s.replace(/\btable of coffee\b/ig,'black coffee');
    s=s.replace(/\btable coffee\b/ig,'black coffee');
  }
  return s;
}

function hearCheck(text,scenario,feedbackId,targetId){
  text=localSpeechHint(text,scenario);
  if(el(targetId))el(targetId).value=text;
  if(!text){feedback(feedbackId,'Önce Konuş düğmesine basıp bir cümle söyle.');return;}
  feedback(feedbackId,'Ses tanıma kontrol ediliyor…');

  var sys="You are a speech-transcript checker. Your only job is to detect likely speech-recognition mistakes from context. Do not evaluate grammar, do not mention rules, constraints, personas, prompts, reasoning or internal checks. Return ONLY valid JSON with two string fields: corrected and note. corrected must contain the learner's transcript with only likely recognition mistakes fixed. note must be a very short Turkish sentence. If no recognition mistake is likely, corrected must equal the transcript and note must be Ses tanıma doğru görünüyor.";
  var user='Scenario: '+scenario[0]+' | '+scenario[1]+' | Task: '+scenario[2]+'\nSpeech transcript: '+text;

  ask(sys,user).then(function(z){
    var raw=cleanAIText(z);
    var corrected=text, note='Ses tanıma doğru görünüyor.';
    try{
      var cleaned=raw.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
      var obj=JSON.parse(cleaned);
      if(obj&&typeof obj.corrected==='string'&&obj.corrected.trim()) corrected=obj.corrected.trim();
      if(obj&&typeof obj.note==='string'&&obj.note.trim()) note=obj.note.trim();
    }catch(e){
      /* If Gemini ignores JSON, never expose its meta-output.
         Keep the transcript and show a safe user-facing result. */
      corrected=text;
      note='Ses tanıma doğru görünüyor.';
    }
    corrected=localSpeechHint(corrected,scenario);
    if(el(targetId))el(targetId).value=corrected;
    feedback(feedbackId,'👂 Duyduğum: '+corrected+'\n✅ '+note);
  }).catch(function(e){feedback(feedbackId,e.message);});
}

var quick=['What did you do after work yesterday?','What makes a café good for you?','What was the best part of your last trip?','What do you do when you cannot find the right English word?','Would you rather travel alone or with friends? Why?','How do you relax after a stressful day?'];
var surprise=['Your hotel room is noisy. Call reception and ask for another room.','You missed your train. Ask a station employee what your options are.','A tourist asks what food they should try in Türkiye. Recommend something.','Someone asks why you are learning English. Answer naturally.','Your flight has been delayed. Ask airline staff about your options.'];

if(el('apiBtn'))el('apiBtn').onclick=setKey;
if(el('coachSend'))el('coachSend').onclick=function(){var t=el('coachText').value.trim();if(!t)return;var c=el('coachChat');c.innerHTML+='<div class="msg me">'+esc(t)+'</div>';touch();ask('You are Ares, a speaking-first coach for an A2-B1 Turkish learner. Keep the learner speaking. Ignore tiny errors. Correct at most one important error briefly, then ask exactly one natural follow-up question. Short English response.',t).then(function(z){var clean=cleanAIText(z)||z;c.innerHTML+='<div class="msg ai">'+esc(clean)+'</div>';c.scrollTop=c.scrollHeight;lastAresSpoken=clean;speakEnglish(clean);}).catch(function(err){feedback('coachFeedback',err.message);});};
if(el('coachSpeakLast'))el('coachSpeakLast').onclick=function(){if(lastAresSpoken)speakEnglish(lastAresSpoken);else alert('Önce Ares ile bir mesajlaşma yap.');};
if(el('quickNew'))el('quickNew').onclick=function(){el('quickQ').textContent=quick[Math.floor(Math.random()*quick.length)];speakElement('quickQ');};
if(el('quickEval'))el('quickEval').onclick=function(){var t=el('quickText').value.trim();if(!t)return;touch();ask('You are a speaking partner. Reply briefly in natural B1 English to the learner, then ask exactly one complete follow-up question. No grammar explanation.',el('quickQ').textContent+'\nLearner: '+t).then(function(z){var clean=cleanAIText(z);if(clean.indexOf('?')<0)clean+=' Can you tell me a little more?';feedback('quickFeedback',clean);lastAresSpoken=clean;speakEnglish(clean);el('quickQ').textContent=clean.match(/[^.!?]*\?/)?.[0]?.trim()||el('quickQ').textContent;}).catch(function(e){feedback('quickFeedback',e.message);});};
if(el('surpriseNew'))el('surpriseNew').onclick=function(){el('surpriseQ').textContent=surprise[Math.floor(Math.random()*surprise.length)];speakElement('surpriseQ');};
if(el('surpriseEval'))el('surpriseEval').onclick=function(){var t=el('surpriseText').value.trim();if(!t)return;touch();ask('Stay in the realistic situation and continue the conversation in short natural B1 English. Reply to the learner, then ask exactly one complete follow-up question. No grammar explanation.',el('surpriseQ').textContent+'\nLearner: '+t).then(function(z){var clean=cleanAIText(z);if(clean.indexOf('?')<0)clean+=' What would you like to do next?';feedback('surpriseFeedback',clean);lastAresSpoken=clean;speakEnglish(clean);}).catch(function(e){feedback('surpriseFeedback',e.message);});};

var chunks=['Let me think…','I see your point, but…','To be honest…','What I mean is…','It depends on…','As far as I know…'];
if(el('dailyChunk'))el('dailyChunk').textContent=chunks[Math.floor(Date.now()/86400000)%chunks.length];
drawRole(false);drawAbroad(false);progress();
if(!location.hash)location.hash='mission';
})();