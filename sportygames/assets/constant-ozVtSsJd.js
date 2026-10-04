import{o as e,r as t}from"./rolldown-runtime-DAXXjFlN.js";import{t as n}from"./right-arrow-pjE7qqh7.js";import{t as r}from"./howler-B5LEEfy8.js";import{t as i}from"./fbg_icon-BFl-B4rO.js";var a=`/sportygames/assets/cashout-DSoHFYhX.mp3`,o=`/sportygames/assets/crash-Di1iE0Ga.mp3`,s=`/sportygames/assets/place_bet-B8pIZvi3.mp3`,c=`/sportygames/assets/background_main-DRzxH_RS.mp3`,l=`/sportygames/assets/background_waiting-R_VrlwhK.mp3`,u=`/sportygames/assets/foul-CClgaEZ6.mp3`,d=`/sportygames/assets/powering_up-CEmC4BN7.mp3`,f=`/sportygames/assets/how_to_play_bet-BzUIFktp.png`,p=`/sportygames/assets/how_to_play_coeff-CzC_SJbY.png`,m=`/sportygames/assets/how_to_play_cashout-C3xP0E8_.png`,h=`/sportygames/assets/red_green-D85xaofG.webp`,g=`/sportygames/assets/title-CQRokQFC.png`,_=`/sportygames/assets/ham_menu_red_green-CuzsaHBI.webp`,v=`/sportygames/assets/red_blue-DrCOTXeQ.webp`,y=`/sportygames/assets/title_mx-BSr7OQku.png`,b=`/sportygames/assets/ham_menu_red_blue_latino-B-aR-hBp.webp`,x=`/sportygames/assets/title_br-CXWs6fCQ.png`,S=`/sportygames/assets/ham_menu_red_blue-C4K8Lj61.webp`,C=t({CHANCE_BET_DEFAULT_PLAYER_MAP:()=>R,COLOR_SCHEME:()=>B,DIRECTIONS:()=>P,MAX_VARIANCE:()=>6,PLAYER:()=>N,PULLING_ANIMATIONS:()=>T,REGION_CONFIG_MAP:()=>z,VARIANCE:()=>F,getDefaultHowToPlay:()=>I,images:()=>L,onboardingCordinates:()=>A,rtpValue:()=>`97%`,sounds:()=>M}),w=e(r()),T=[`pulling/pulling1`,`pulling/pulling2`],E={screenOne:[{rectCord:{x:`6`,y:`415`,rx:`12`,ry:`12`,width:`110`,height:`225`},rectBorderCord:{x:`6`,y:`415`,rx:`12`,ry:`12`,width:`110`,height:`225`,strokeWidth:`3`}}],screenTwo:[{rectCord:{x:`120`,y:`415`,rx:`12`,ry:`12`,width:`236`,height:`110`},rectBorderCord:{x:`120`,y:`415`,rx:`12`,ry:`12`,width:`236`,height:`110`,strokeWidth:`3`}}],screenThree:[{rectCord:{x:`6`,y:`415`,rx:`12`,ry:`12`,width:`110`,height:`225`},rectBorderCord:{x:`6`,y:`415`,rx:`12`,ry:`12`,width:`110`,height:`225`,strokeWidth:`3`}},{rectCord:{x:`120`,y:`415`,rx:`12`,ry:`12`,width:`237`,height:`225`},rectBorderCord:{x:`120`,y:`415`,rx:`12`,ry:`12`,width:`237`,height:`225`,strokeWidth:`3`}}]},D={masks:E.screenOne,textKey:{bottom:`305px`,width:`360px`,key:`bet_on_who_wins`,defaultText:`New! Bet On Who Wins`},imageCord:{left:`54px`,top:`345px`,transform:`scaleY(-1)scaleX(-1)`,width:`60px`,path:n}},O={masks:E.screenTwo,textKey:{bottom:`313px`,width:`360px`,key:`place_crash_bet`,defaultText:`Place Crash Bet`},imageCord:{left:`178px`,top:`345px`,transform:`scaleY(-1)`,width:`60px`,path:n}},k={masks:E.screenThree,textKey:{bottom:`313px`,width:`360px`,key:`place_both_bets`,defaultText:`Place both Crash and Chance bets to win more!`},imageCord:{left:`149px`,top:`345px`,transform:`scaleY(-1)`,width:`60px`,path:n}},A={b00002:[D,O,k],"b00002-no-chat":[D,O,k],b00001:[D,O,k],"b00001-no-chat":[D,O,k],"b00001-am-no-chat":[D,O,k],"b00001-am":[D,O,k]},j=`97%`,M=()=>({cashOut:new w.Howl({src:a}),flyAway:new w.Howl({src:o}),placeBet:new w.Howl({src:s}),backgroundMusicOngoing:new w.Howl({preload:!1,src:[c],loop:!0}),backgroundMusicWaiting:new w.Howl({preload:!1,src:[l],loop:!0}),foul:new w.Howl({src:u}),poweringUpMusic:new w.Howl({src:d})}),N={LEFT:`left`,RIGHT:`right`},P={FRONT:`front`,BACK:`back`},F={BG_MOVE:10,STAGE_MOVE:30,BG_FIGHT:10,STAGE_FIGHT:15},I=e=>({message:`
  ${e} is a crash plus chance game. Two teams are fighting it out to win the match. To win the crash bets, cash out before the crash event which occurs when the match ends! To win the chance bet, guess the right winner. It is very easy to play with the following 5 steps.

    1. Place your BETs before the round starts.
    ${f} 

    2. Up to 3 BETS can be placed, with two crash bets and one chance bet.
    
    3. WATCH the coefficient increase as the teams pull the rope.
    ${p}

    4. CASH OUT the crash bets, before the match ends to win X times your money.
    ${m}
       (X = the coefficient where you cashed out)
    
    5. Place both CRASH and CHANCE bets to win more!

    COEFFICIENTS FOR CRASH BETS

    1. The win coefficients starts at 1x and grows more and more as the match progresses.
    
    2. Your winnings are calculated as : “Your Bet x The coefficient you cashed out at”. 

    GUESS THE WINNER - CHANCE BET

    1. You can place one bet to guess who will win the match.

    2. If chance bet is won, payout is “Your Bet X 2”.

    3. If chance bet is lost, the payout is zero.

    BET & CASHOUT

    1. Select the amount and press the BET button to make a Bet.
       a. Press the CASH OUT button to cash out your winnings for crash bets. 
    2. Your BET is lost if you didn’t cash out before the match ends.
    3. You can place up to two crash bets and one chance bet at a time.
    4. In case of 1.00x crash, both the chance bet as well as crash bets are lost.

    AUTO BET

    Auto Bet will place the entered BET amount automatically in every following round, until turned OFF. 

    AUTO CASHOUT

    Auto Cashout will automatically cash out your winnings when the defined multiplier is reached.

    ONE TAP BET
    
    Turning on One-Tap Bet will stop bet confirmations from appearing.

    FREE BET GIFT

    1. You can check the Free Bet Gifts available for you by clicking on the Gift icon on the screen. If you do not have any Free Bet Gifts available, the Gift icon will not be shown.
    ${i}
    2. You can choose to use the full gift amount or the partial gift amount for your bet.
    3. You cannot place a bet using real money along with Free Bet Gift. You can only use one of the two to place bet.`,title:`About ${e}`,gameName:e}),L={brandSpecificCommonImages:[],brandCommonImages:[`how_to_play_coeff.png`,`red_green.webp`,`red_blue.webp`,`how_to_play_bet.png`,`how_to_play_cashout.png`],commonImages:[`gift-icon-bethistory.png`,`cross_blue_bg.svg`,`ticket.png`,`ham_music.png`,`ham_sound.png`,`ham_one_tap_bet.png`,`ham_fair_settings.png`,`ham_how_to_play.png`,`ham_bet_history.png`,`game_limits.svg`,`chat.svg`,`ham.svg`,`gift-close.png`,`notification_bg.png`,`ham_avatar.svg`]},R={1:{label:`Blue`,color:`blue`,side:N.RIGHT},2:{label:`Red`,color:`red`,side:N.LEFT}},z={ng:{gameName:`Tug of War`,firstBetButton:{label:`Nigeria`,color:`green`,betOnPlayerId:1},secondBetButton:{label:`Ghana`,color:`red`,betOnPlayerId:2},1:{label:`Nigeria`,color:`green`,side:N.LEFT},2:{label:`Ghana`,color:`red`,side:N.RIGHT},flagSkin:`NG`,playerSkin:`NG`,chanceBet:h,title:g,hamMenu:_},gh:{gameName:`Tug of War`,firstBetButton:{label:`Ghana`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`Nigeria`,color:`green`,betOnPlayerId:1},1:{label:`Nigeria`,color:`green`,side:N.RIGHT},2:{label:`Ghana`,color:`red`,side:N.LEFT},flagSkin:`GH`,playerSkin:`GH`,chanceBet:h,title:g,hamMenu:_},mx:{gameName:`De un Jalón`,firstBetButton:{label:`México`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`USA`,color:`blue`,betOnPlayerId:1},1:{label:`USA`,color:`blue`,side:N.RIGHT},2:{label:`México`,color:`red`,side:N.LEFT},flagSkin:`MX`,playerSkin:`MX`,chanceBet:v,title:y,hamMenu:b},za:{gameName:`Tug of War`,firstBetButton:{label:`South Africa`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`Nigeria`,color:`green`,betOnPlayerId:1},1:{label:`Nigeria`,color:`green`,side:N.RIGHT},2:{label:`South Africa`,color:`red`,side:N.LEFT},flagSkin:`ZA`,playerSkin:`GH`,chanceBet:h,title:g,hamMenu:_},ke:{gameName:`Tug of War`,firstBetButton:{label:`Kenya`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`Nigeria`,color:`green`,betOnPlayerId:1},1:{label:`Nigeria`,color:`green`,side:N.RIGHT},2:{label:`Kenya`,color:`red`,side:N.LEFT},flagSkin:`KE`,playerSkin:`GH`,chanceBet:h,title:g,hamMenu:_},br:{gameName:`Cabo De Guerra`,firstBetButton:{label:`Red`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`Blue`,color:`blue`,betOnPlayerId:1},...R,flagSkin:`BR`,playerSkin:`MX`,chanceBet:v,title:x,hamMenu:b},int:{gameName:`Cabo De Guerra`,firstBetButton:{label:`Red`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`Blue`,color:`blue`,betOnPlayerId:1},...R,flagSkin:`BR`,playerSkin:`MX`,chanceBet:v,title:x,hamMenu:b},zm:{gameName:`Tug of War`,firstBetButton:{label:`Red`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`Blue`,color:`blue`,betOnPlayerId:1},...R,flagSkin:`ZM`,playerSkin:`TZ`,chanceBet:v,title:g,hamMenu:S},cm:{gameName:`Tug of War`,firstBetButton:{label:`Red`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`Blue`,color:`blue`,betOnPlayerId:1},...R,flagSkin:`CM`,playerSkin:`TZ`,chanceBet:v,title:g,hamMenu:S},tz:{gameName:`Tug of War`,firstBetButton:{label:`Red`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`Blue`,color:`blue`,betOnPlayerId:1},...R,flagSkin:`TZ`,playerSkin:`TZ`,chanceBet:v,title:g,hamMenu:S},default:{gameName:`Tug of War`,firstBetButton:{label:`Red`,color:`red`,betOnPlayerId:2},secondBetButton:{label:`Blue`,color:`blue`,betOnPlayerId:1},...R,flagSkin:`default`,playerSkin:`TZ`,chanceBet:v,title:g,hamMenu:S}},B={red:{progressBar:`linear-gradient(90deg, #FF141B 0%, #C50006 100%)`,bgGradient:`linear-gradient(90deg, rgba(73, 0, 0, 0.60) 0%, rgba(207, 0, 0, 0.60) 52.77%, rgba(158, 0, 0, 0.18) 105.54%)`,winnerGradient:`linear-gradient(90deg, rgba(73, 0, 0, 0.18) 0%, rgba(207, 0, 0, 0.60) 52.77%, rgba(158, 0, 0, 0.18) 105.54%)`},blue:{progressBar:`linear-gradient(90deg, #0045E5 0%, #0372FB 100%)`,bgGradient:`linear-gradient(270deg, rgba(61, 168, 255, 0.60) 0%, rgba(0, 81, 255, 0.60) 50%, rgba(61, 168, 255, 0.00) 100%)`,winnerGradient:`linear-gradient(270deg, rgba(61, 168, 255, 0.18) 0%, rgba(0, 81, 255, 0.60) 50%, rgba(61, 168, 255, 0.18) 100%)`},green:{progressBar:`linear-gradient(90deg, #009606 0%, #00DA08 100%)`,bgGradient:`linear-gradient(90deg, rgba(12, 131, 0, 0.60) -5.54%, rgba(3, 29, 0, 0.60) 100%)`,winnerGradient:`linear-gradient(90deg, rgba(5, 58, 0, 0.18) 0.01%, rgba(5, 60, 0, 0.60) 50%, rgba(5, 52, 0, 0.18) 99.99%)`}};export{u as C,o as D,s as E,a as O,d as S,c as T,g as _,C as a,p as b,A as c,S as d,x as f,_ as g,v as h,z as i,j as l,y as m,N as n,I as o,b as p,T as r,L as s,B as t,M as u,h as v,l as w,f as x,m as y};