import{o as e,r as t}from"./rolldown-runtime-DAXXjFlN.js";import{t as n}from"./right-arrow-pjE7qqh7.js";import{t as r}from"./howler-B5LEEfy8.js";var i=`/sportygames/assets/onboarding_bg-DrQ6rKUa.webp`,a=`/sportygames/assets/cashout-D1aFQLi8.mp3`,o=`/sportygames/assets/crash-DYF05a9e.mp3`,s=`/sportygames/assets/place_bet-Bhi-nYwj.mp3`,c=`/sportygames/assets/main_bgm-DcO3TjJa.mp3`,l=`/sportygames/assets/waiting_bgm-D0OPMI2B.mp3`,u=`/sportygames/assets/collect-BpzdASiD.mp3`,d=`/sportygames/assets/how_to_play_bet-BHE7tmU2.webp`,f=`/sportygames/assets/how_to_play_coeff-D5lCZHbS.webp`,p=`/sportygames/assets/how_to_play_cashout-DT0LkaoA.webp`,m=t({FASTER_ANIMATION_SPEED:()=>T,MULTIPLIER_STYLE:()=>D,SLOWER_ANIMATION_SPEED:()=>E,TOTAL_ANIMATION_FRAMES:()=>90,getDefaultHowToPlay:()=>C,images:()=>w,onboardingCoordinates:()=>b,rtpValue:()=>`97%`,sounds:()=>S}),h=e(r()),g=[{rectCord:{x:181,y:449,rx:12,ry:12,width:178,height:194},rectBorderCord:{x:`181`,y:`449`,rx:`12`,ry:`12`,width:`178`,height:`194`,strokeWidth:`3`}}],_=[{rectCord:{x:55,y:100,rx:12,ry:12,width:250,height:300},rectBorderCord:{x:55,y:100,rx:12,ry:12,width:250,height:300,strokeWidth:`3`}}],v={masks:g,textKey:{bottom:`282px`,width:`150px`,left:`56px`,key:`place_bet`,defaultText:`Place Bet`},imageCord:{left:`178px`,top:`368px`,transform:`scaleY(-1)`,width:`60px`,path:n}},y={masks:_,bgImage:i,textKey:{top:`20px`,width:`212px`,left:`20px`,key:`collect_boost_items`,page:`sg_jungle_run`,defaultText:`Collect boost items to speed up!`},imageCord:{left:`225px`,top:`30px`,transform:`scaleY(-1)`,width:`60px`,path:n}},b={b00001:[v,y],"b00001-no-chat":[v,y],"b00001-am-no-chat":[v,y],"b00001-am":[v,y],b00003:[v,y],"b00003-no-chat":[v,y]},x=`97%`,S=()=>({cashOut:new h.Howl({src:a}),flyAway:new h.Howl({src:o}),placeBet:new h.Howl({src:s}),backgroundMusicOngoing:new h.Howl({preload:!1,src:[c],loop:!0}),backgroundMusicWaiting:new h.Howl({preload:!1,src:[l],loop:!0}),collect:new h.Howl({src:u})}),C=e=>({message:`
  ${e} is a crash game inspired by an exciting jungle adventure. An archaeologist character is shown exploring and running through a dense jungle. Collect powerful boost items such as a Golden Compass, Binoculars and Treasure Chests along the way to speed up the run. Cash out before the crash event, which occurs when the trail suddenly collapses and the character falls into a pit. It's easy to play in just 4 simple steps.

    1. Place a BET before the round starts.
    ${d} 

    2. WATCH the coefficient increase as the character runs in the jungle.
    ${f}

    3. COLLECT boost items to speed up!

    4. CASH OUT before the round ends and the trail collapses to win X times your money.
    ${p}
       (X = the coefficient where you cashed out)

    COEFFICIENTS

    1. The win coefficient starts at 1x and grows more and more as the round proceeds.
    2. Your winnings are calculated as : “Your Bet x The coefficient you cashed out at”.

    BET & CASHOUT

    1. Select the amount and press the BET button to make a Bet.
       a. Press the CASH OUT button to cash out your winnings. 
    2. Your BET is lost if you didn’t cash out before the round ends and the trail collapses.
    3. You can place upto two bets at a time.

    AUTO BET

    Auto Bet will place the entered BET amount automatically in every following round, until turned OFF. 

    AUTO CASHOUT

    Auto Cashout will automatically cash out your winnings when the defined multiplier is reached.

    ONE TAP BET
    
    Turning on One-Tap Bet will stop bet confirmations from appearing.`,title:`About ${e}`,gameName:e}),w={brandCommonImages:[`ham_menu_bg.png`,`title.webp`],brandSpecificCommonImages:[],commonImages:[`gift-icon-bethistory.png`,`cross_blue_bg.svg`,`ticket.png`,`ham_music.png`,`ham_sound.png`,`ham_one_tap_bet.png`,`ham_fair_settings.png`,`ham_how_to_play.png`,`ham_bet_history.png`,`game_limits.svg`,`chat.png`,`ham.svg`,`gift-close.png`,`notification_bg.png`,`ham_avatar.svg`,`what_is_provably_fair_1.png`,`what_is_provably_fair_2.png`,`what_is_provably_fair_3.png`]},T=1.7,E=1.3,D={GLOW:`glow`,NORMAL:`normal`};export{o as _,C as a,x as c,f as d,d as f,s as g,c as h,m as i,S as l,l as m,D as n,w as o,u as p,E as r,b as s,T as t,p as u,a as v,i as y};