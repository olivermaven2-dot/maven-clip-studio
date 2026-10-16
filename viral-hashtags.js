(() => {
  const $ = id => document.getElementById(id);
  const categoryTags = {
    'Football / Sports commentary': ['#Football', '#SportsHighlights', '#SportsAnalysis'],
    'Podcast / Interview': ['#PodcastClips', '#Interview', '#Conversation'],
    'Motivation': ['#Motivation', '#Mindset', '#PersonalGrowth'],
    'Gaming': ['#Gaming', '#Gameplay', '#GamingHighlights'],
    'Education': ['#LearnSomething', '#Explained', '#UsefulTips'],
    'Comedy': ['#FunnyMoments', '#Comedy', '#FunnyVideos'],
    'Music': ['#Music', '#MusicMoments', '#MusicLovers'],
    'News / Commentary': ['#Commentary', '#Explained', '#CurrentEvents'],
    'General': ['#Highlights', '#MustWatch', '#ViralMoment']
  };
  const momentTags = {
    hook: ['#WaitForIt', '#Unexpected'],
    sports: ['#SportsHighlights', '#GameChangingMoment'],
    funny: ['#FunnyReaction', '#Unexpected'],
    surprise: ['#PlotTwist', '#UnexpectedMoment'],
    useful: ['#QuickTips', '#LearnSomething'],
    analysis: ['#Breakdown', '#Explained']
  };
  const status = (message, kind='') => {
    const el=$('hashtagStatus'); el.textContent=message;
    el.classList.remove('hidden','success','error'); if(kind)el.classList.add(kind);
  };
  const normalizeTag = value => {
    const words=String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').match(/[\p{L}\p{N}]+/gu)||[];
    if(!words.length)return '';
    const tag=words.map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join('');
    return tag.length>=2 ? '#'+tag.slice(0,45) : '';
  };
  const unique = items => [...new Set(items.filter(Boolean).map(x=>x.trim()))];
  const selectedRadarMoment = () => {
    const list=Array.isArray(window.mavenRadar?.candidates)?window.mavenRadar.candidates:[];
    const select=$('storyCandidate');
    if(select && select.value!=='' && list[Number(select.value)])return list[Number(select.value)];
    return null;
  };
  const generate = () => {
    const topic=$('hashtagTopic').value.trim();
    const keywords=$('hashtagKeywords').value.trim();
    const chosen=$('hashtagCategory').value;
    const category=chosen==='auto' ? ($('category')?.value||'General') : chosen;
    const momentChoice=$('hashtagMoment').value;
    const candidate=selectedRadarMoment();
    const inferred=String(candidate?.momentType||'').toLowerCase();
    const moment=momentChoice==='auto'
      ? (inferred.includes('sport')?'sports':inferred.includes('funny')?'funny':inferred.includes('surpris')?'surprise':inferred.includes('useful')?'useful':inferred.includes('hook')?'hook':'analysis')
      : momentChoice;
    if(!topic && !keywords){
      status('Describe the specific clip or add its names / niche keywords first, so the hashtags match this video.','error');
      return;
    }
    const topicParts=topic.split(/[.!?;,|]+/).map(s=>s.trim()).filter(Boolean);
    const keyParts=keywords.split(/[,;|]+/).map(s=>s.trim()).filter(Boolean);
    const specific=unique([...keyParts.map(normalizeTag),...topicParts.slice(0,2).map(normalizeTag)]);
    const niche=categoryTags[category]||categoryTags.General;
    const momentSet=momentTags[moment]||momentTags.analysis;
    const youtube=unique([...specific,...niche.slice(0,2),...momentSet.slice(0,1),'#Shorts']).slice(0,7);
    const facebook=unique([...specific,...niche.slice(0,2),...momentSet.slice(0,2),'#FacebookReels']).slice(0,7);
    $('youtubeHashtagOutput').value=youtube.join(' ');
    $('facebookHashtagOutput').value=facebook.join(' ');
    status('Generated focused suggestions from your topic, category, and moment type. Remove any tag that does not accurately describe the clip.','success');
  };
  const copy = async id => {
    const value=$(id).value.trim();
    if(!value){status('Generate a hashtag set first.','error');return}
    try { await navigator.clipboard.writeText(value); status('Hashtags copied.','success'); }
    catch(e) {
      $(id).focus(); $(id).select();
      const ok=document.execCommand('copy');
      status(ok?'Hashtags copied.':'Copy was blocked; the hashtag text is selected so you can copy it manually.',ok?'success':'error');
    }
  };
  $('generateHashtags').addEventListener('click',generate);
  $('useYtHashtags').addEventListener('click',()=>{
    const value=$('youtubeHashtagOutput').value.trim();
    if(!value){status('Generate the YouTube set first.','error');return}
    $('hashtags').value=value;
    status('YouTube hashtag set added to the post draft. Review it before saving.','success');
  });
  $('copyYoutubeHashtags').addEventListener('click',()=>copy('youtubeHashtagOutput'));
  $('copyFacebookHashtags').addEventListener('click',()=>copy('facebookHashtagOutput'));
  $('clearHashtags').addEventListener('click',()=>{
    ['hashtagTopic','hashtagKeywords'].forEach(id=>$(id).value='');
    $('hashtagCategory').value='auto'; $('hashtagMoment').value='auto';
    $('youtubeHashtagOutput').value=''; $('facebookHashtagOutput').value='';
    status('Hashtag fields cleared.');
  });
})();