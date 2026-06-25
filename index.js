const express = require('express');
const {createServer} = require('node:http');
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
  // Valid password - return token
  const token = Buffer.from(`${page}:${password}:${Date.now()}`).toString('base64');
  res.json({ token, page });
});

// Protect pages - check token in query string
app.get(/^\/pages\/(p1|p2|p3)\.html$/, (req, res, next) => {
  const token = req.query.token;
  const pageMatch = req.path.match(/\/pages\/(p1|p2|p3)\.html/);
  const page = pageMatch[1];
  
  if (!token) {
    return res.status(403).send('Token không hợp lệ.');
  }
  
  try {
    const decoded = Buffer.from(token, 'base64').toString();
    const [tokenPage] = decoded.split(':');
    
    if (tokenPage !== page) {
      return res.status(403).send('Token không hợp lệ.');
    }
    
    // Valid token, serve the page
    res.sendFile(join(__dirname, 'public', req.path));
  } catch (error) {
    return res.status(403).send('Token không hợp lệ.');
  }
});

app.use(express.static('public'))

let puzzle=[]
let solvedPuzzle=[]
let question=''
let explain=''
let puzzleState=[] // 0: empty, 1: has letter, 2: selected, 3: revealed
let buzzed=[]
let puzzleMode=1
let isFinalSpin=false
let tossupInterval=null
let bonusTimeInterval=null
let fsTimeout=null
let bonusTime=0
let currentRotation=0
let currentBonusRotation=0

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
    total:0,
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
    total:0,
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
    total:0,
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

io.on('connection',(socket)=>{
  socket.emit('puzzleMode',puzzleMode)
  socket.emit('finalSpinMode',isFinalSpin)
  socket.emit('data', { score,currentRotation,wedgesStatus:Object.fromEntries(wedgesStatus) })
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
    solvedPuzzle=data.solved
    question=data.question
    explain=data.explain
    for(let i=0;i<56;i++){
      if(puzzle[i]=='') puzzleState[i]=0
      else if(puzzle[i]=='?'||puzzle[i]=='-'||puzzle[i]=='!'||puzzle[i]=='.'||puzzle[i]==','||puzzle[i]=="&"||puzzle[i]=='/') puzzleState[i]=3
      else puzzleState[i]=1
    }
  })
  socket.on('puzzleType',(type)=>{
    io.emit('puzzleType',type,question)
  })
  socket.on('togglePuzzleMode',()=>{
    puzzleMode=1-puzzleMode
    io.emit('puzzleMode',puzzleMode)
  })
  socket.on('toggleFinalSpinMode',()=>{
    isFinalSpin=!isFinalSpin
    io.emit('finalSpinMode',isFinalSpin)
    io.emit('playSound', '../sounds/chuong finalspin.mp3')
  })

  socket.on('scoreboard',(data)=>{
    console.log(data,score)
    score.p1.name=data.p1.name
    score.p1.score=data.p1.score
    score.p1.total=data.p1.total
    score.p2.name=data.p2.name
    score.p2.score=data.p2.score
    score.p2.total=data.p2.total
    score.p3.name=data.p3.name
    score.p3.score=data.p3.score
    score.p3.total=data.p3.total
    io.emit('scoreboard',data)
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
    io.emit('solvePuzzle', { solvedPuzzle, mode })
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
  socket.on('spinBonusWheel',()=>{
    currentBonusRotation += getRandomInt(1080, 1440)
    io.emit('playSound', '../sounds/nhacquaynondacbiet.m4a')
    io.emit('spinBonusWheel', currentBonusRotation,15)
  })
  socket.on('indicatePlayer', (player) => {
    io.emit('indicatePlayer', player)
  })
  socket.on('showWheel', round => {
    if(round=='bonus') io.emit('showWheel', 'bonus')
    else io.emit('showWheel', round)
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
  socket.on('showKs', () => {
    io.emit('showKs')
  })
  socket.on('hideKs', () => {
    io.emit('hideKs')
  })
  socket.on('setKsScore', (ksScore) => {
    score.ks.score=ksScore
    console.log('setKsScore', ksScore)
    io.emit('setKsScore', ksScore)
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
})