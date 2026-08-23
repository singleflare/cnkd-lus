const express = require('express');
const {createServer} = require('node:http');
const {randomBytes} = require('node:crypto');
const app = express();
const server=createServer(app)
const {Server}=require('socket.io')
const io=new Server(server)
server.listen(3000)
const { join } = require('node:path');

// Password protection - controller sets these
let pagePasswords = {
  p1: '',
  p2: '',
  p3: ''
};
const pageTokens = new Map();

app.use(express.json());

// Controller sets passwords for pages
app.post('/api/set-passwords', (req, res) => {
  const { nc1, nc2, nc3 } = req.body;
  if (nc1) pagePasswords.p1 = nc1;
  if (nc2) pagePasswords.p2 = nc2;
  if (nc3) pagePasswords.p3 = nc3;
  res.json({ message: 'Passwords updated', pagePasswords });
});

// Validate password and return token
app.post('/api/validate-password', (req, res) => {
  const { page, password } = req.body;
  
  if (!page || !password) return res.status(400).json({ error: 'Page and password required' });
  if (!pagePasswords[page] || pagePasswords[page] !== password) return res.status(403).json({ error: 'Invalid password' });
  // Keep tokens opaque so they can be revoked by the controller.
  const token = randomBytes(32).toString('hex');
  pageTokens.set(token, page);
  res.json({ token, page });
});

// Protect pages - check token in query string
app.get(/^\/pages\/(p1|p2|p3)\.html$/, (req, res) => {
  const token = req.query.token;
  const pageMatch = req.path.match(/\/pages\/(p1|p2|p3)\.html/);
  const page = pageMatch[1];

  if (!token || pageTokens.get(token) !== page) {
    return res.status(403).send('Token không hợp lệ.');
  }

  pageTokens.delete(token);
  res.set('Cache-Control', 'no-store');
  res.sendFile(join(__dirname, 'public', req.path));
});

app.use(express.static('public'))
console.log('http://localhost:3000/pages/controller.html')

let puzzle=[],solvedPuzzle=[],solvedPuzzleAfterGiaima=[],puzzleState=[],buzzed=[]
let question=''
let puzzleMode=1
let isFinalSpin=false
let tossupInterval=null
let bonusTimeInterval=null
let fsTimeout=null
let bonusTime=0
let currentRotation=0
let currentBonusRotation=0
let puzzleNumber=-1
let wheelNumber=1
let isBonusPrizeWith1m=false
let messageHistory=[]

let wedgesStatus=new Map()
wedgesStatus.set('obm700', false)
wedgesStatus.set('obm300', false)
wedgesStatus.set('gl12500450300', false)
wedgesStatus.set('gl12500350900', false)
wedgesStatus.set('nhandoi', false)
wedgesStatus.set('cohoi', false)
wedgesStatus.set('phanthuong', false)
wedgesStatus.set('gl1m', false)
wedgesStatus.set('themluot', false)
wedgesStatus.set('mayman', false)

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

let score={
  p1:{
    name:'',
    score:0,
    eachRoundScore:[0,0,0,0,0,0,0,0,0,0,0,0],
    wedges:{
      'themluot': false,
      'cohoi': false,
      'nhandoi': false,
      'phanthuong': false,
      'mayman': false,
      'gl1m': false,
      'gl12500450300': false,
      'gl12500350900': false,
    },
    qualify:false
  },
  p2:{
    name:'',
    score:0,
    eachRoundScore:[0,0,0,0,0,0,0,0,0,0,0,0],
    wedges:{
      'themluot': false,
      'cohoi': false,
      'nhandoi': false,
      'phanthuong': false,
      'mayman': false,
      'gl1m': false,
      'gl12500450300': false,
      'gl12500350900': false,
    },
    qualify:false
  },
  p3:{
    name:'',
    score:0,
    eachRoundScore:[0,0,0,0,0,0,0,0,0,0,0,0],
    wedges:{
      'themluot': false,
      'cohoi': false,
      'nhandoi': false,
      'phanthuong': false,
      'mayman': false,
      'gl1m': false,
      'gl12500450300': false,
      'gl12500350900': false,
    },
    qualify:false
  },
  ks:{
    score:0,
    wedges:{
      'themluot': false,
      'cohoi': false,
      'nhandoi': false,
      'phanthuong': false,
      'mayman': false,
      'gl1m': false,
      'gl12500450300': false,
      'gl12500350900': false,
    }
  }
}

let bonusPrizes = [40, 40, 40, 40, 40, 40, 45, 45, 45, 45, 45, 50, 50, 50, 50, 55, 55, 55, 60, 60, 65, 65, 75, 100]
let bonusPrizesWith1m = [40, 40, 40, 40, 40, 40, 45, 45, 45, 45, 45, 50, 50, 50, 50, 55, 55, 55, 60, 60, 65, 65, 75, '1mgl']
let prizePrizes = ['NHÂN 1,5', 'NHÂN 2', 'KHÁNG MĐ', '0 GL', '50 GL', '100 GL', '150 GL', '200 GL', '250 GL', '300 GL','350 GL', '400 GL', '500 GL', '600 GL', '700 GL', '800 GL', '900 GL', '1000 GL', '1500 GL', '2000 GL']
let mysteryPrizes = ['10k', 'MĐ']
function shuffle(array) {
  let currentIndex = array.length;
  // While there remain elements to shuffle...
  while (currentIndex != 0) {
    // Pick a remaining element...
    let randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }
}

io.on('connection',(socket)=>{
  socket.emit('messageHistory', messageHistory)
  socket.emit('puzzleMode',puzzleMode)
  socket.emit('finalSpinMode',isFinalSpin)
  socket.emit('data', { score,currentRotation,wheelNumber,wedgesStatus:Object.fromEntries(wedgesStatus)})
  for(let i=0;i<56;i++){
    if(puzzleState[i]==1) socket.emit('reveal',{index:i,state:1})
    else if(puzzleState[i]==2) socket.emit('reveal',{index:i,state:2})
    else if(puzzleState[i]==3) socket.emit('reveal',{index:i,state:3,letter:puzzle[i]})
  }
  socket.on('buzz',(data)=>{
    buzzed.push(data)
    if(buzzed.length==1){
      io.emit('playSound', '../sounds/ding.mp3')
      console.log(buzzed)
      clearInterval(tossupInterval)
      clearInterval(bonusTimeInterval)
      io.emit('buzzed',buzzed[0])
    }
  })
  socket.on('resetBuzzers',()=>{
    buzzed=[]
    io.emit('buzzersReset')
  })
  socket.on('puzzle',(data)=>{
    io.emit('resetPuzzle')
    io.emit('hostPuzzle',data)
    puzzle=data.puzzle
    question=data.question
    explain=data.explain
    puzzleNumber=data.puzzleNumber
    solvedPuzzle=data.solvedPuzzle
    solvedPuzzleAfterGiaima=data.solvedPuzzleAfterGiaima
    for(let i=0;i<56;i++){
      if(puzzle[i]=='') puzzleState[i]=0
      else if(puzzle[i]=='?'||puzzle[i]=='-'||puzzle[i]=='!'||puzzle[i]=='.'||puzzle[i]==','||puzzle[i]=="&"||puzzle[i]=='/') puzzleState[i]=3
      else puzzleState[i]=1
    }
    console.log(puzzle, solvedPuzzle, solvedPuzzleAfterGiaima)
  })
  socket.on('puzzleType',(type)=>{
    io.emit('puzzleType',type,question)
  })
  socket.on('togglePuzzleMode',()=>{
    puzzleMode=1-puzzleMode
    io.emit('puzzleMode',puzzleMode)
  })
  socket.on('toggleFinalSpinMode',()=>{
    if(isFinalSpin==false) io.emit('playSound', '../sounds/chuong finalspin.mp3')
    isFinalSpin=!isFinalSpin
    io.emit('finalSpinMode',isFinalSpin)
  })

  socket.on('updateScoreboard',(method,player,inputScore)=>{
    console.log('updateScoreboard', method, player, inputScore)
    if(method=='set') {
      if(player==1) score.p1.score=inputScore
      else if(player==2) score.p2.score=inputScore
      else if(player==3) score.p3.score=inputScore
      else if(player=='ks') score.ks.score=inputScore
    }
    else if(method=='plus') {
      if(player==1) score.p1.score+=inputScore
      else if(player==2) score.p2.score+=inputScore
      else if(player==3) score.p3.score+=inputScore
      else if(player=='ks') score.ks.score+=inputScore
    }
    else if(method=='minus') {
      if(player==1) score.p1.score-=inputScore
      else if(player==2) score.p2.score-=inputScore
      else if(player==3) score.p3.score-=inputScore
    }
    else if(method=='oneHalf') {
      if(player==1) score.p1.score*=1.5
      else if(player==2) score.p2.score*=1.5
      else if(player==3) score.p3.score*=1.5
    }
    else if(method=='half') {
      if(player==1) score.p1.score/=2
      else if(player==2) score.p2.score/=2
      else if(player==3) score.p3.score/=2
    }
    else if(method=='double') {
      if(player==1) score.p1.score*=2
      else if(player==2) score.p2.score*=2
      else if(player==3) score.p3.score*=2
    }
    else if(method=='zero') {
      if(player==1) score.p1.score=0
      else if(player==2) score.p2.score=0
      else if(player==3) score.p3.score=0
      else if(player=='ks') score.ks.score=0
    }
    else if(method=='name') {
      if(player==1) score.p1.name=inputScore
      else if(player==2) score.p2.name=inputScore
      else if(player==3) score.p3.name=inputScore
    }
    else if(method=='total'){
      if(player==1) score.p1.total=inputScore
      else if(player==2) score.p2.total=inputScore
      else if(player==3) score.p3.total=inputScore
    }
    io.emit('scoreboard',player,score)
  })

  socket.on('revealPuzzle',()=>{
    io.emit('revealPuzzle',puzzle)
  })
  socket.on('reveal',(idx)=>{
    if(isFinalSpin) {
      clearTimeout(fsTimeout)
      fsTimeout=setTimeout(()=>{
        io.emit('playSound', '../sounds/sai.mp3')
      }, 5000)
    }
    if(puzzleMode==0) {
      if(puzzleState[idx]==1) {
        puzzleState[idx]=3
        io.emit('disableLetterBtn',idx)
      }
    }
    else{
      if(puzzleState[idx]==1) {
        if(!isFinalSpin){
          io.emit('playSound', '../sounds/ding.mp3')
        }
        puzzleState[idx]=2
      }
      else if(puzzleState[idx]==2) {
        puzzleState[idx]=3
        io.emit('disableLetterBtn',idx)
      }
    }
    console.log(idx, puzzleState[idx], puzzle[idx])
    io.emit('reveal',{index:idx,state:puzzleState[idx],letter:puzzle[idx]})
  })
  socket.on('individualLetter',(letter)=>{
    let idxToOpen=[]
    for(let i=0;i<56;i++){
      if(letter=='DB'){
        let bonusLetters=['N','G','H','I','A']
        bonusLetters.forEach(bonusLetter=>{
          if((puzzle[i]==bonusLetter&&puzzleState[i]==1)||(puzzle[i]==bonusLetter&&puzzleState[i]==2)){
            idxToOpen.push(i)
          }
        })
      }
      else if((puzzle[i]==letter&&puzzleState[i]==1)||(puzzle[i]==letter&&puzzleState[i]==2)) {
        idxToOpen.push(i)
      }
    }
    if(idxToOpen.length==0) {
      io.emit('playSound', '../sounds/sai.mp3')
    }
    else{
      console.log(idxToOpen)
      if(puzzleState[idxToOpen[0]]==1) {
        if(!isFinalSpin) io.emit('playSound', '../sounds/ding.mp3')
        for(let i=0;i<idxToOpen.length;i++){
          puzzleState[idxToOpen[i]]=2
          console.log(puzzleState[idxToOpen[i]])
          io.emit('reveal',{index:idxToOpen[i],state:2,letter:puzzle[idxToOpen[i]]})
        }
      }
      else if(puzzleState[idxToOpen[0]]==2) {
        if(isFinalSpin) {
          clearTimeout(fsTimeout)
          fsTimeout=setTimeout(()=>{
            io.emit('playSound', '../sounds/sai.mp3')
          }, 5000)
        }
        for(let i=0;i<idxToOpen.length;i++){
          puzzleState[idxToOpen[i]]=3
          io.emit('reveal',{index:idxToOpen[i],state:3,letter:puzzle[idxToOpen[i]]})
          io.emit('disableLetterBtn',idxToOpen[i])
        }
      }
    }
  })
  socket.on('undoOpenedLetters',()=>{
    for(let i=0;i<56;i++){
      if(puzzleState[i]==2) {
        puzzleState[i]=1
        io.emit('reveal',{index:i,state:1})
      }
    }
  })
  socket.on('solvePuzzle',(mode)=>{ 
    socket.emit('stopAllSounds')
    console.log(solvedPuzzle)
    buzzed=[]
    io.emit('buzzersReset')
    let idxToOpen=[]
    for(let i=0;i<56;i++){
      if(puzzleState[i]==1) puzzleState[i]=3
      if(puzzleState[i]==3) idxToOpen.push(i)
    }
    io.emit('solvePuzzle', { solvedPuzzle,solvedPuzzleAfterGiaima, mode })
  })
  socket.on('solvePuzzleNoSound',()=>{
    buzzed=[]
    io.emit('buzzersReset')
    let idxToOpen=[]
    for(let i=0;i<56;i++){
      if(puzzleState[i]==1) puzzleState[i]=3
      if(puzzleState[i]==3) idxToOpen.push(i)
    }
    io.emit('solvePuzzle', { solvedPuzzle, mode: 'normal' })
  })
  socket.on('resetPuzzle',()=>{
    puzzle=[]
    solvedPuzzle=[]
    puzzleState=[]
    io.emit('resetPuzzle')
  })
  socket.on('puzzleMode',(data)=>{
    puzzleMode=data
  })
  socket.on('openRandomTossup',()=>{
    io.emit('openRandomTossup')
    buzzed=[]
    io.emit('buzzersReset')
    io.emit('enableBuzzers')
    let idxToOpen=[]
    for(let i=0;i<56;i++){
      if(puzzleState[i]==1) idxToOpen.push(i)
    }
    shuffleArray(idxToOpen)
    console.log(idxToOpen)
    let i=0
    io.emit('reveal',{index:idxToOpen[i],state:3,letter:puzzle[idxToOpen[i]]})
    puzzleState[idxToOpen[i]]=3
    io.emit('disableLetterBtn',idxToOpen[i])
    i++
    tossupInterval = setInterval(()=>{
      if(i>=idxToOpen.length) clearInterval(tossupInterval)
      else {
        const idx = idxToOpen[i]
        io.emit('reveal',{index:idx,state:3,letter:puzzle[idx]})
        console.log(idx, puzzleState[idx], puzzle[idx])
        puzzleState[idx]=3
        io.emit('disableLetterBtn',idx)
        i++
      }
    },1000)
  })
  socket.on('openRandomTossupWithTime',()=>{
    io.emit('enableBuzzers')
    io.emit('bonusTime',bonusTime)
    bonusTimeInterval=setInterval(()=>{
      io.emit('bonusTime',--bonusTime)
      if(bonusTime==0) {
        clearInterval(tossupInterval)
        clearInterval(bonusTimeInterval)
      }
    },1000)
    let idxToOpen=[]
    for(let i=0;i<56;i++){
      if(puzzleState[i]==1) idxToOpen.push(i)
    }
    shuffleArray(idxToOpen)
    console.log(idxToOpen)
    let i=0
    io.emit('reveal',{index:idxToOpen[i],state:3,letter:puzzle[idxToOpen[i]]})
    puzzleState[idxToOpen[i]]=3
    io.emit('disableLetterBtn',idxToOpen[i])
    i++
    tossupInterval = setInterval(()=>{
      if(i>=idxToOpen.length) clearInterval(tossupInterval)
      else {
        const idx = idxToOpen[i]
        io.emit('reveal',{index:idx,state:3,letter:puzzle[idx]})
        puzzleState[idx]=3
        io.emit('disableLetterBtn',idx)
        i++
      }
    },1000)
  })
  socket.on('stopOpenRandomTossup',()=>{
    clearInterval(tossupInterval)
    clearInterval(bonusTimeInterval)
  })
  socket.on('continueOpenRandomTossup',()=>{
    buzzed=[]
    io.emit('buzzersReset')
    io.emit('enableBuzzers')
    let idxToOpen=[]
    for(let i=0;i<56;i++){
      if(puzzleState[i]==1) idxToOpen.push(i)
    }
    shuffleArray(idxToOpen)
    console.log(idxToOpen)
    let i=0
    io.emit('reveal',{index:idxToOpen[i],state:3,letter:puzzle[idxToOpen[i]]})
    puzzleState[idxToOpen[i]]=3
    io.emit('disableLetterBtn',idxToOpen[i])
    i++
    tossupInterval = setInterval(()=>{
      if(i>=idxToOpen.length) clearInterval(tossupInterval)
      else {
        const idx = idxToOpen[i]
        io.emit('reveal',{index:idx,state:3,letter:puzzle[idx]})
        console.log(idx, puzzleState[idx], puzzle[idx])
        puzzleState[idx]=3
        io.emit('disableLetterBtn',idx)
        i++
      }
    },1000)
  })
  socket.on('startTossUpBonus',()=>{
    io.emit('enableBuzzers')
    bonusTimeInterval=setInterval(()=>{
      io.emit('bonusTime',--bonusTime)
      if(bonusTime==0) {
        clearInterval(tossupInterval)
        clearInterval(bonusTimeInterval)
      }
    },1000)
    let idxToOpen=[]
    for(let i=0;i<56;i++){
      if(puzzleState[i]==1) {
        idxToOpen.push(i)
        if(puzzle[i]=='N'||puzzle[i]=='H'||puzzle[i]=='A'||puzzle[i]=='?'||puzzle[i]=='-'||puzzle[i]=='!'||puzzle[i]=='.'||puzzle[i]==','||puzzle[i]=="&"||puzzle[i]=='/') {
          puzzleState[i]=3
          io.emit('reveal',{index:i,state:3,letter:puzzle[i]})
          io.emit('disableLetterBtn',i)
          idxToOpen.pop()
        }
        io.emit('reveal',{index:i,state:1})
      }
    }
    shuffleArray(idxToOpen) 
    console.log(idxToOpen)
    let i=0
    tossupInterval = setInterval(()=>{
      if(i>=idxToOpen.length) clearInterval(tossupInterval)
      else {
        const idx = idxToOpen[i]
        io.emit('reveal',{index:idx,state:3,letter:puzzle[idx]})
        io.emit('disableLetterBtn',idx)
        i++
      }
    },1000)
  })
  socket.on('setBonusTime',(time)=>{
    bonusTime=time
    io.emit('bonusTime',time)
    clearInterval(bonusTimeInterval)
  })
  socket.on('playSound',url=>{
    io.emit('playSound',url)
    console.log(url)
  })
  socket.on('chatMessage', (text) => {
    const messageText = (text || '').toString().trim()
    if (!messageText) return
    const message = {
      text: messageText,
      timestamp: new Date().toISOString()
    }
    messageHistory.push(message)
    if (messageHistory.length > 100) messageHistory.shift()
    io.emit('chatMessage', message)
  })
  socket.on('stopAllSounds',()=>{
    io.emit('stopAllSounds')
  })

  function getRandomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
  }
  socket.on('spinWheel',()=>{
    currentRotation += getRandomInt(1440, 1800)
    if(isFinalSpin){
      io.emit('playSound', '../sounds/finalspin.mp3')
      io.emit('spinWheel', currentRotation,5)
    }
    else {
      io.emit('playSound', '../sounds/nhacquaynon.mp3')
      io.emit('spinWheel', currentRotation,8)
    }
  })
  socket.on('resetWheel',()=>{
    currentRotation = 0
    io.emit('spinWheel', currentRotation,3)
  })
  socket.on('spinBonusWheel',()=>{
    currentBonusRotation += getRandomInt(1080, 1440)
    io.emit('playSound', '../sounds/nhacquaynondacbiet.m4a')
    io.emit('spinBonusWheel', currentBonusRotation,15)
  })
  socket.on('indicatePlayer', (player) => {
    io.emit('indicatePlayer', player)
  })
  socket.on('showWheel', round => {
    wheelNumber=round
    if(round=='bonus') io.emit('showWheel', 'bonus')
    else{
      wedgesStatus.set('cohoi', true)
      wedgesStatus.set('themluot', true)
      wedgesStatus.set('mayman', true)
      wedgesStatus.set('gl1m', true)
      wedgesStatus.set('gl12500450300', true)
      wedgesStatus.set('gl12500350900', true)
      wedgesStatus.set('phanthuong', true)
      io.emit('toggleWedge', 'cohoi', true)
      io.emit('toggleWedge', 'themluot', true)
      io.emit('toggleWedge', 'mayman', true)
      io.emit('toggleWedge', 'gl1m', true)
      io.emit('toggleWedge', 'gl12500450300', true)
      io.emit('toggleWedge', 'gl12500350900', true)
      io.emit('toggleWedge', 'phanthuong', true)
      if(round==1){        
        wedgesStatus.set('obm700', false)
        wedgesStatus.set('obm300', false)
        wedgesStatus.set('nhandoi', true)
        io.emit('toggleWedge', 'nhandoi', true)
        io.emit('toggleWedge', 'obm700', false)
        io.emit('toggleWedge', 'obm300', false)
      }
      else if(round==2){
        wedgesStatus.set('obm700', true)
        wedgesStatus.set('obm300', true)
        wedgesStatus.set('nhandoi', false)
        io.emit('toggleWedge', 'obm700', true)
        io.emit('toggleWedge', 'obm300', true)
        io.emit('toggleWedge', 'nhandoi', false)
      }
      else if(round==3||round==4||round==5){
        wedgesStatus.set('obm700', false)
        wedgesStatus.set('obm300', false)
        wedgesStatus.set('nhandoi', false)
        io.emit('toggleWedge', 'obm700', false)
        io.emit('toggleWedge', 'obm300', false)
        io.emit('toggleWedge', 'nhandoi', false)
      }
      io.emit('showWheel', round)
    } 
  })

  socket.on('togglePlayerWedge', (player, wedge) => {
    console.log('togglePlayerWedge', player, wedge,score.p1.wedges[wedge], score.p2.wedges[wedge], score.p3.wedges[wedge])
    const statusOnWheel = wedgesStatus.get(wedge)
    if(statusOnWheel==true) {
      wedgesStatus.set(wedge, !statusOnWheel)
      io.emit('toggleWedge', wedge, !statusOnWheel)
    }
    if(player==1){
      score.p1.wedges[wedge]=!score.p1.wedges[wedge]
      io.emit('togglePlayerWedge', player, score.p1.wedges[wedge], wedge)
    }
    else if(player==2){
      score.p2.wedges[wedge]=!score.p2.wedges[wedge]
      io.emit('togglePlayerWedge', player, score.p2.wedges[wedge], wedge)
    }
    else if(player==3){
      score.p3.wedges[wedge]=!score.p3.wedges[wedge]
      io.emit('togglePlayerWedge', player, score.p3.wedges[wedge], wedge)
    }
    else if(player=='ks'){
      score.ks.wedges[wedge]=!score.ks.wedges[wedge]
      io.emit('togglePlayerWedge', player, score.ks.wedges[wedge], wedge)
    }
  })
  socket.on('toggleWedge', (wedge) => {
    console.log(wedge, wedgesStatus.get(wedge))
    const currentStatus = wedgesStatus.get(wedge)
    wedgesStatus.set(wedge, !currentStatus)
    io.emit('toggleWedge', wedge, !currentStatus)
  })
  socket.on('untoggleAllWedges', () => {
    for (const [wedge, status] of wedgesStatus.entries()) {
      if (status) {
        wedgesStatus.set(wedge, false)
        io.emit('toggleWedge', wedge, false)
      }
    }
  })
  socket.on('showKs', () => {
    io.emit('showKs')
  })
  socket.on('hideKs', () => {
    io.emit('hideKs')
  })
  socket.on('showTotal', () => {
    io.emit('showTotal', {
      p1: score.p1.total,
      p2: score.p2.total,
      p3: score.p3.total
    })
  })
  socket.on('showSt', () => {
    io.emit('showSt')
  })
  socket.on('hideSt', () => {
    io.emit('hideSt')
  })
  socket.on('setPlayerQualify', (player) => {
    if(player==1){
      score.p1.qualify=!score.p1.qualify
      io.emit('setPlayerQualify', player, score.p1.qualify)
    }
    else if(player==2){
      score.p2.qualify=!score.p2.qualify
      io.emit('setPlayerQualify', player, score.p2.qualify)
    }
    else if(player==3){
      score.p3.qualify=!score.p3.qualify
      io.emit('setPlayerQualify', player, score.p3.qualify)
    }
    console.log(score.p1.qualify, score.p2.qualify, score.p3.qualify)
  })
  socket.on('unlockSpin', (player) => {
    io.emit('unlockSpin', player)
  })
  socket.on('lockSpinButton', (player) => {
    io.emit('lockSpinButton', player)
  })
  socket.on('randomizeBonusPrizes', () => {
    shuffle(bonusPrizes)
    isBonusPrizeWith1m=false
    io.emit('bonusPrizes', bonusPrizes)
  })
  socket.on('randomizeBonusPrizesWith1m', () => {
    shuffle(bonusPrizesWith1m)
    isBonusPrizeWith1m=true
    io.emit('bonusPrizesWith1m', bonusPrizesWith1m)
  })
  socket.on('randomizePrizePrizes', () => {
    shuffle(prizePrizes)
    io.emit('prizePrizes', prizePrizes)
  })
  socket.on('hidePrizePrizes', () => {
    io.emit('hidePrizePrizes')
  })
  socket.on('showPrizePanel', () => {
    io.emit('showPrizePanel')
  })
  socket.on('hidePrizePanel', () => {
    io.emit('hidePrizePanel')
  })
  socket.on('randomizeMysteryPrizes', () => {
    shuffle(mysteryPrizes)
    io.emit('mysteryPrizes', mysteryPrizes)
  })
  socket.on('revealMysteryPrize', (value) => {
    io.emit('revealMysteryPrize', value, mysteryPrizes[value === 700 ? 0 : 1])
  })
  socket.on('revealPrize', (i) => {
    io.emit('revealPrize', i, prizePrizes[i - 1])
  })
  socket.on('revealBonusPrize', (i) => {
    io.emit('revealBonusPrize', isBonusPrizeWith1m?bonusPrizesWith1m[i - 1]:bonusPrizes[i - 1])
  })
  socket.on('show3Categories', (categories) => {
    io.emit('show3Categories',categories)
  })
  socket.on('hide3Categories', () => {
    io.emit('hide3Categories')
  })
  socket.on('chooseCategory', (cat,catName) => {
    io.emit('chooseCategory', cat, catName)
  })
  socket.on('showBonusGraphics', () => {
    io.emit('showBonusGraphics')
  })
  socket.on('hideBonusGraphics', () => {
    io.emit('hideBonusGraphics')
  })
  socket.on('playThinkGpx', () => {
    io.emit('playThinkGpx')
  })
  socket.on('playAnswerGpx', () => {
    io.emit('playAnswerGpx')
  })
  socket.on('bonusLetter', (pos ,letter) => {
    io.emit('bonusLetter', pos ,letter)
  })
  socket.on('showEnvelope', () => {
    io.emit('showEnvelope')
  })
  socket.on('closeEnvelope', () => {
    io.emit('closeEnvelope')
  })
  socket.on('hideEnvelope', () => {
    io.emit('hideEnvelope')
  })
  socket.on('logoutAllPlayerWebs', () => {
    pageTokens.clear()
    io.emit('logoutAllPlayerWebs')
  })
  socket.on('log',msg=>{
    const message={text:msg, timestamp: new Date().toISOString()}
    messageHistory.push(message)
    if (messageHistory.length > 100) messageHistory.shift()
    io.emit('systemLog', message)
  })
})