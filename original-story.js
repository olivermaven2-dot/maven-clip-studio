(() => {
  const $ = id => document.getElementById(id);
  const status = (message, kind='') => {
    const el=$('storyStatus'); el.textContent=message;
    el.classList.remove('hidden','success','error'); if(kind)el.classList.add(kind);
  };
  const candidates = () => Array.isArray(window.mavenRadar?.candidates) ? window.mavenRadar.candidates : [];
  const stamp = n => { n=Math.max(0,Number(n)||0); const m=Math.floor(n/60),s=Math.floor(n%60); return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0'); };
  const refreshCandidates = () => {
    const select=$('storyCandidate'), list=candidates(), previous=select.value;
    select.replaceChildren(new Option('No moment selected — write your own topic',''));
    list.forEach((item,i)=>{
      const label=(item.title||item.excerpt||item.reason||'Candidate moment '+(i+1)).toString().replace(/\s+/g,' ').slice(0,85);
      const opt=new Option(stamp(item.start)+'–'+stamp(item.end)+' · '+label,String(i)); select.add(opt);
    });
    if(previous && [...select.options].some(o=>o.value===previous))select.value=previous;
  };
  $('storyCandidate').addEventListener('focus',refreshCandidates);
  $('storyCandidate').addEventListener('change',()=>{
    const item=candidates()[Number($('storyCandidate').value)];
    if(!item)return;
    const excerpt=String(item.excerpt||item.title||'').trim();
    if(excerpt && !$('storyContext').value.trim())$('storyContext').value=excerpt;
    status('Moment selected: '+stamp(item.start)+'–'+stamp(item.end)+'. Add your own explanation and takeaway before building the script.','success');
  });
  const build = () => {
    const context=$('storyContext').value.trim(), angle=$('storyAngle').value.trim(), takeaway=$('storyTakeaway').value.trim();
    if(!context){status('Describe what happens in the moment first. This helps keep the script specific and accurate.','error');return}
    if(!angle || !takeaway){status('Add your own interpretation and a viewer takeaway. These are the parts that make the script more than a caption or simple repost.','error');return}
    const format=$('storyFormat').value, voice=$('storyVoice').value;
    const starts={
      analysis:'Here is what is really happening — and the detail worth noticing.',
      educational:'Here is one useful thing you can learn from this moment.',
      reaction:'This moment gets interesting when you notice one detail.',
      sports:'Let’s break down the key moment and why it matters.',
      story:'At first, this looks like a simple moment. Then notice what happens.'
    };
    const style={
      direct:'Keep the delivery natural and specific, as if explaining it to a friend.',
      energetic:'Use short sentences, a strong pace, and a clear emphasis on the key detail.',
      calm:'Explain the sequence step by step and leave space for viewers to follow.',
      playful:'Keep it light without humiliating people or inventing motives.'
    };
    const parts=[
      'HOOK (first 1–3 seconds)\n'+starts[format],
      'CONTEXT\n'+context,
      'YOUR ORIGINAL COMMENTARY\n'+angle,
      'VIEWER TAKEAWAY\n'+takeaway,
      'CLOSING / ENGAGEMENT\nWhat detail did you notice first? Share your view — and follow for more original breakdowns.',
      'DELIVERY NOTE\n'+style[voice]
    ];
    $('storyOutput').textContent=parts.join('\n\n');
    status('Commentary draft built locally. Read it aloud, replace anything generic, and confirm all claims before exporting.','success');
  };
  $('buildOriginalStory').addEventListener('click',build);
  $('clearOriginalStory').addEventListener('click',()=>{
    ['storyContext','storyAngle','storyTakeaway'].forEach(id=>$(id).value='');
    $('storyCandidate').value='';
    ['storyCheckContext','storyCheckVoice','storyCheckRights','storyCheckAudio'].forEach(id=>$(id).checked=false);
    $('storyOutput').textContent='Choose a moment or enter your topic, then add your own explanation and takeaway. Your draft will be built locally in this browser.';
    status('Story fields cleared.');
  });
  $('copyOriginalStory').addEventListener('click',async()=>{
    const text=$('storyOutput').textContent;
    if(!text.trim()){status('Build a script first.','error');return}
    try{await navigator.clipboard.writeText(text);status('Script copied to clipboard.','success')}
    catch(e){const area=document.createElement('textarea');area.value=text;area.style.position='fixed';area.style.opacity='0';document.body.append(area);area.select();const ok=document.execCommand('copy');area.remove();status(ok?'Script copied to clipboard.':'Copy was blocked by this browser; select the script text and copy it manually.',ok?'success':'error')}
  });
  refreshCandidates();
})();