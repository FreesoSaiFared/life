// ==UserScript==
// @name         Transductive Reddit Contributor Continuation
// @namespace    https://transductive.org/
// @version      0.2.0
// @description  Continues a transductive Reddit article session when ChatGPT emits a CONTINUE payload.
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(()=>{
  'use strict';
  const seen=new Set(),pending=new Set();
  const last=()=>[...document.querySelectorAll('[data-message-author-role="assistant"]')].at(-1)?.innerText||'';
  const composer=()=>document.querySelector('#prompt-textarea,[contenteditable="true"][data-lexical-editor="true"]');
  const send=()=>document.querySelector('[data-testid="send-button"],button[aria-label*="Send" i]');
  const extract=t=>t.match(/(?:^|\n)CONTINUE(?:, IMMEDIATELY, AUTOSUBMIT)?\s*:\s*([\s\S]+)$/i)?.[1]?.trim()||null;
  const submit=(payload,key)=>{
    const c=composer();if(!c)return false;c.focus();document.execCommand('selectAll',false,null);document.execCommand('insertText',false,payload);c.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:payload}));
    let tries=0;const press=()=>{const b=send();if(b&&!b.disabled){b.click();pending.delete(key);seen.add(key);return}if(++tries<24){setTimeout(press,250)}else{pending.delete(key)}};setTimeout(press,150);return true;
  };
  const tick=()=>{const payload=extract(last());if(!payload)return;const key=location.href+'\n'+payload;if(seen.has(key)||pending.has(key))return;pending.add(key);if(!submit(payload,key))pending.delete(key)};
  new MutationObserver(()=>setTimeout(tick,350)).observe(document.documentElement,{subtree:true,childList:true,characterData:true});setInterval(tick,2500);
})();
