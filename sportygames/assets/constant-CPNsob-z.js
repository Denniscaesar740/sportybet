import{o as e,r as t}from"./rolldown-runtime-DAXXjFlN.js";import{t as n}from"./right-arrow-pjE7qqh7.js";import{t as r}from"./howler-B5LEEfy8.js";var i=`/sportygames/assets/layout_1-DecRlze8.webp`,a=`/sportygames/assets/layout_2-8GfNh_2M.webp`,o=`/sportygames/assets/layout_3-BZvS43CF.webp`,s=`/sportygames/assets/layout_4-Cknjtk4s.webp`,c=`/sportygames/assets/onboarding-CW9b-lQH.webp`,l=`/sportygames/assets/how_to_play_bet-ChCnCXB6.webp`,u=`/sportygames/assets/how_to_play_aircraft-l1X0e2Wf.webp`,d=`/sportygames/assets/how_to_play_coeff-B-jBbjy_.webp`,f=`/sportygames/assets/how_to_play_cashout-CcWOySd1.webp`,p=e(r()),m=`/sportygames/assets/cashout-CvrAxQ9o.mp3`,h=`/sportygames/assets/place_bet-DBuqMyC4.mp3`,g=`/sportygames/assets/jet_click-BvFQYWQD.mp3`,_=`/sportygames/assets/jet_1-4fXSMRUj.mp3`,v=`/sportygames/assets/crash_1-Cv5Z5_Vg.mp3`,y=`/sportygames/assets/background_main_1-B4c8wDSr.mp3`,b=`/sportygames/assets/jet_2-BRo9NQdd.mp3`,x=`/sportygames/assets/crash_2-CrW5qsBq.mp3`,S=`/sportygames/assets/background_main_2-C_hUbCBN.mp3`,C=`/sportygames/assets/jet_3-BlA6YXg9.mp3`,w=`/sportygames/assets/crash_3-6KGhM1hP.mp3`,T=`/sportygames/assets/background_main_3-j5qVT9ax.mp3`,E=`/sportygames/assets/jet_4-DAD0ez5B.mp3`,D=`/sportygames/assets/crash_4-DTRDMMaw.mp3`,O=`/sportygames/assets/background_main_4-mBg90f0M.mp3`,k=`/sportygames/assets/background_waiting-DqKb0jez.mp3`,A=`/sportygames/assets/level_unlock-Df8ExFFl.mp3`,j=t({BIRD_FILTER_BY_APPEARANCE:()=>M,BIRD_SLOW_APPEARANCES:()=>z,JET_LAYOUT_OPTIONS:()=>N,LAYOUT_4_JET_SHINE_ANIMATION:()=>I,LAYOUT_4_SHINE_START_DELAY_MS:()=>R,LAYOUT_4_UNLOCK_ANIMATION:()=>P,LAYOUT_4_UNLOCK_PHASE:()=>B,LAYOUT_4_UNLOCK_START_DELAY_MS:()=>500,LAYOUT_4_UNLOCK_STATIC_ANIMATION:()=>F,getDefaultHowToPlay:()=>Q,images:()=>$,onboardingCoordinates:()=>G,rtpValue:()=>`97%`,sounds:()=>Z}),M={skin1:`sepia(1) saturate(5.5) hue-rotate(352deg) brightness(0.72)`,skin2:`sepia(1) saturate(4.2) hue-rotate(164deg) brightness(0.43)`,skin3:`sepia(1) saturate(4.2) hue-rotate(167deg) brightness(0.42)`,skin4:`none`},N=[{value:`skin1`,label:`Jet 1`,titleKey:`jet_1_title`,subtitleKey:`jet_1_subtitle`,fallbackTitle:`DESERT ADVENTURE`,fallbackSubtitle:`Biplane`,image:i},{value:`skin2`,label:`Jet 2`,titleKey:`jet_2_title`,subtitleKey:`jet_2_subtitle`,fallbackTitle:`MOUNTAIN RESCUE`,fallbackSubtitle:`Helicopter`,image:a},{value:`skin3`,label:`Jet 3`,titleKey:`jet_3_title`,subtitleKey:`jet_3_subtitle`,fallbackTitle:`ISLAND ESCAPE`,fallbackSubtitle:`Seaplane`,image:o},{value:`skin4`,label:`Jet 4`,titleKey:`jet_4_title`,subtitleKey:`jet_4_subtitle`,fallbackTitle:`TECHNOCITY CHASE`,fallbackSubtitle:`Flying Car`,image:s}],P=`Unlock`,F=`Unlock static`,I=`Jet shine`,L=500,R=1e3,z=new Set([`skin1`,`skin2`]),B={LOCKED:`locked`,UNLOCKING:`unlocking`,SHINING:`shining`,UNLOCKED:`unlocked`},V=[{rectCord:{x:`181`,y:`449`,rx:`12`,ry:`12`,width:`178`,height:`194`},rectBorderCord:{x:`181`,y:`449`,rx:`12`,ry:`12`,width:`178`,height:`194`,strokeWidth:`3`}}],H=[{rectCord:{y:`80`,x:`2`,rx:`12`,ry:`12`,width:`358`,height:`250`},rectBorderCord:{y:`80`,x:`2`,rx:`12`,ry:`12`,width:`358`,height:`250`,strokeWidth:`3`}}],U={masks:V,textKey:{bottom:`282px`,width:`150px`,left:`56px`,key:`place_bet`,defaultText:`Place Bet`},imageCord:{left:`178px`,top:`368px`,transform:`scaleY(-1)`,width:`60px`,path:n}},W={masks:H,bgImageKey:{key:`onboarding_screen_two_image`,page:`sg_sky_legends`,defaultImage:c},textKey:{top:`360px`,width:`150px`,left:`20px`,key:`select_aircraft`,page:`sg_sky_legends`,defaultText:`Select your aircraft to fly!`},imageCord:{left:`175px`,top:`340px`,width:`60px`,path:n}},G={b00001:[U,W],"b00001-no-chat":[U,W],"b00001-am-no-chat":[U,W],"b00001-am":[U,W],b00003:[U,W],"b00003-no-chat":[U,W]},K=`97%`,q=[`skin1`,`skin2`,`skin3`,`skin4`],J={skin1:_,skin2:b,skin3:C,skin4:E},Y={skin1:v,skin2:x,skin3:w,skin4:D},X={skin1:y,skin2:S,skin3:T,skin4:O},Z=()=>{let e=q.reduce((e,t)=>(e[`jetEngine_${t}`]=new p.Howl({src:J[t]}),e[`flyAway_${t}`]=new p.Howl({src:Y[t]}),e[`backgroundMusicOngoing_${t}`]=new p.Howl({src:[X[t]],loop:!0}),e),{});return{cashOut:new p.Howl({src:m}),placeBet:new p.Howl({src:h}),jetClick:new p.Howl({src:g}),levelUnlockSound:new p.Howl({src:A}),backgroundMusicWaiting:new p.Howl({preload:!1,src:[k],loop:!0}),...e}},Q=e=>({message:`
  ${e} is a crash game inspired by featuring various amazing aircrafts. You can select your choice of aircraft before the round starts. Cash out before the crash event, which occurs when the aircraft flies away. It's easy to play in just 4 simple steps.

    1. Place a BET before the round starts.
    ${l} 

    2. SELECT an aircraft before the round starts.
    ${u} 

    3. WATCH the coefficient increase as the aircraft flies.
    ${d}

    4. CASH OUT before the round ends and the aircraft flies away to win X times your money.
    ${f}
       (X = the coefficient where you cashed out)

    COEFFICIENTS

    1. The win coefficient starts at 1x and grows more and more as the round proceeds.
    2. Your winnings are calculated as : “Your Bet x The coefficient you cashed out at”.

    BET & CASHOUT

    1. Select the amount and press the BET button to make a Bet.
       a. Press the CASH OUT button to cash out your winnings. 
    2. Your BET is lost if you didn’t cash out before the round ends and the aircraft flies away.
    3. You can place upto two bets at a time.

    AUTO BET

    Auto Bet will place the entered BET amount automatically in every following round, until turned OFF. 

    AUTO CASHOUT

    Auto Cashout will automatically cash out your winnings when the defined multiplier is reached.

    AIRCRAFT SELECTION

    1. Before the round starts, an aircraft can be selected.

    2. Previous choice of aircraft will continue if the selection is not changed.

    3. The fourth aircraft unlocks after the number of bets shown on the screen.

    ONE TAP BET
    
    Turning on One-Tap Bet will stop bet confirmations from appearing.`,title:`About ${e}`,gameName:e}),$={brandSpecificCommonImages:[],brandCommonImages:[`onboarding.webp`,`ham_menu.png`,`title.png`,`layout_1.webp`,`layout_2.webp`,`layout_3.webp`,`layout_4.webp`,`tick.png`],commonImages:[`gift-icon-bethistory.png`,`cross_blue_bg.svg`,`ticket.png`,`ham_music.png`,`ham_sound.png`,`ham_one_tap_bet.png`,`ham_fair_settings.png`,`ham_how_to_play.png`,`ham_bet_history.png`,`game_limits.svg`,`chat.png`,`ham.svg`,`gift-close.png`,`notification_bg.png`,`ham_avatar.svg`,`what_is_provably_fair_1.png`,`what_is_provably_fair_2.png`,`what_is_provably_fair_3.png`]};export{g as A,a as B,C,y as D,b as E,u as F,l as I,c as L,m as M,f as N,v as O,d as P,s as R,w as S,x as T,i as V,k as _,R as a,E as b,L as c,Q as d,$ as f,A as g,Z as h,I as i,h as j,_ as k,F as l,K as m,z as n,P as o,G as p,N as r,B as s,M as t,j as u,O as v,S as w,T as x,D as y,o as z};