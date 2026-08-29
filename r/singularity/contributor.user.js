// ==UserScript==
// @name         Transductive Reddit Contributor Continuation
// @namespace    https://transductive.org/
// @version      0.1.0
// @description  Continues a transductive Reddit article session when ChatGPT emits a CONTINUE payload.
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

(()=>{
  'use strict';
  const seen=new Set();
  const textOfLastAssistant=()=>{
    const turns=[...document.querySelectorAll('[data-message-author-role="assistant"]')];
    return turns.at(-1)?.innerText||'';
  };
  const composer=()=>document.querySelector('#prompt-textarea,[contenteditable="true"][data-lexical-editor="true"]');
  const send=()=>document.querySelector('[data-testid="send-button"],button[aria-label*="Send" i]');
  const extract=t=>{
    const m=t.match(/(?:^|\n)CONTINUE(?:, IMMEDIATELY, AUTOSUBMIT)?\s*:\s*([\s\S]+)$/i);
    return m?.[1]?.trim()||null;
  };
  const submit=payload=>{
    const c=composer(); if(!c)return false;
    c.focus();
    document.execCommand('selectAll',false,null);
    document.execCommand('insertText',false,payload);
    c.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:payload}));
    setTimeout(()=>send()?.click(),180);
    return true;
  };
  const tick=()=>{
    const t=textOfLastAssistant();
    const payload=extract(t);
    if(!payload)return;
    const key=location.href+'\n'+payload;
    if(seen.has(key))return;
    if(submit(payload))seen.add(key);
  };
  new MutationObserver(()=>setTimeout(tick,350)).observe(document.documentElement,{subtree:true,childList:true,characterData:true});
  setInterval(tick,2500);
})();
