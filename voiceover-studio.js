(() => {
  const $ = id => document.getElementById(id);
  const startBtn=$('voiceoverStart'), stopBtn=$('voiceoverStop'), deleteBtn=$('voiceoverDelete');
  const status=(message,kind='')=>{
    const el=$('voiceoverStatus');el.textContent=message;el.className='notice'+(kind?' '+kind:'');
  };
  let stream=null,recorder=null,chunks=[],blob=null,url=null,timer=null,startedAt=0,elapsed=0;
  const formatTime=seconds=>String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(Math.floor(seconds%60)).padStart(2,'0');
  const setTimer=()=>{$('voiceoverTimer').textContent=formatTime(elapsed+(recorder&&recorder.state==='recording'?(Date.now()-startedAt)/1000:0))};
  const supportedTypes=()=>['audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/webm','audio/ogg'].filter(t=>window.MediaRecorder&&MediaRecorder.isTypeSupported(t));
  const releaseStream=()=>{if(stream){stream.getTracks().forEach(track=>track.stop());stream=null}};
  const cleanupUrl=()=>{if(url){URL.revokeObjectURL(url);url=null}};
  const resetUi=()=>{startBtn.disabled=false;stopBtn.disabled=true;deleteBtn.disabled=!blob;$('voiceoverReview').classList.toggle('hidden',!blob)};
  startBtn.addEventListener('click',async()=>{
    if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia||!window.MediaRecorder){status('This browser does not support microphone recording. Try a recent desktop version of Chrome or Edge.','error');return}
    startBtn.disabled=true;status('Requesting microphone access…');
    try{
      stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      const choices=supportedTypes(),requested=$('voiceoverFormat').value;
      let mimeType='';
      if(requested!=='auto'&&MediaRecorder.isTypeSupported(requested))mimeType=requested;
      else if(choices.length)mimeType=choices[0];
      recorder=mimeType?new MediaRecorder(stream,{mimeType}):new MediaRecorder(stream);
      chunks=[];elapsed=0;startedAt=Date.now();
      recorder.ondataavailable=event=>{if(event.data&&event.data.size)chunks.push(event.data)};
      recorder.onerror=()=>{status('Recording failed. Check microphone permission and try again.','error');releaseStream();if(timer){clearInterval(timer);timer=null}startBtn.disabled=false;stopBtn.disabled=true};
      recorder.onstop=()=>{
        if(timer){clearInterval(timer);timer=null}
        elapsed+=(Date.now()-startedAt)/1000;setTimer();releaseStream();
        if(chunks.length){
          blob=new Blob(chunks,{type:recorder.mimeType||chunks[0].type||'audio/webm'});cleanupUrl();url=URL.createObjectURL(blob);
          $('voiceoverAudio').src=url;
          const ext=blob.type.includes('ogg')?'ogg':blob.type.includes('mp4')?'m4a':'webm';
          $('voiceoverDownload').href=url;$('voiceoverDownload').download='maven-voiceover-'+new Date().toISOString().replace(/[:.]/g,'-')+'.'+ext;
          $('voiceoverReview').classList.remove('hidden');deleteBtn.disabled=false;
          status('Recording ready. Listen back before downloading. Audio stays on this device unless you choose to download it.','success');
        }else{status('No audio data was captured. Check your microphone and try again.','error');blob=null}
        startBtn.disabled=false;stopBtn.disabled=true;
      };
      recorder.start(250);stopBtn.disabled=false;deleteBtn.disabled=true;
      $('voiceoverReview').classList.add('hidden');status('Recording… Speak clearly, then select Stop recording.','success');
      timer=setInterval(setTimer,250);
    }catch(err){
      releaseStream();startBtn.disabled=false;stopBtn.disabled=true;
      const msg=err&&err.name==='NotAllowedError'?'Microphone access was denied. Allow microphone access for this site in your browser settings.':err&&err.name==='NotFoundError'?'No microphone was found. Connect or enable a microphone and try again.':'Could not start recording. Check browser permissions and ensure the page is served over HTTPS.';
      status(msg,'error');
    }
  });
  stopBtn.addEventListener('click',()=>{
    if(recorder&&recorder.state==='recording'){stopBtn.disabled=true;status('Finishing recording…');recorder.stop()}
  });
  deleteBtn.addEventListener('click',()=>{
    if(recorder&&recorder.state==='recording')return;
    if(!blob)return;
    if(!confirm('Delete this recorded take? Downloaded files will not be affected.'))return;
    if($('voiceoverAudio')){$('voiceoverAudio').pause();$('voiceoverAudio').removeAttribute('src');$('voiceoverAudio').load()}
    cleanupUrl();blob=null;chunks=[];elapsed=0;$('voiceoverTimer').textContent='00:00';$('voiceoverReview').classList.add('hidden');deleteBtn.disabled=true;
    status('Take deleted from this page.'); 
  });
  $('voiceoverToScript').addEventListener('click',()=>{
    const output=$('storyOutput'),target=$('storyAngle');
    const script=output&&output.textContent.trim();
    if(!script||script.startsWith('Choose a moment')){status('Build your commentary script first, then you can read it while recording.','error');return}
    if(target){target.value=script.slice(0,700);target.dispatchEvent(new Event('input',{bubbles:true}));target.scrollIntoView({behavior:'smooth',block:'center'});status('Script copied into the commentary notes field. You can read it aloud while recording.','success')}
    else status('Your script is available in Original Story Builder.','error');
  });
  window.mavenGetVoiceoverBlob=()=>blob;\n  window.addEventListener('beforeunload',()=>{if(timer)clearInterval(timer);releaseStream();cleanupUrl()});
})();
