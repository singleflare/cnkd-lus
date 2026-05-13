const express = require('express');
const {createServer} = require('node:http');
const app = express();
const server=createServer(app)
const {Server}=require('socket.io')
const io=new Server(server)
server.listen(3000)
const { join } = require('node:path');

app.use(express.static('public'))

let puzzle=[]
let solvedPuzzle=[]
let puzzleState=[] // 0: empty, 1: has letter, 2: selected, 3: revealed
let buzzed=[]
let puzzleMode=1
let isFinalSpin=false
let tossupInterval=null
let bonusTimeInterval=null
let bonusTime=0

let wedgesStatus=new Map()
wedgesStatus.set('obm500', 0)
wedgesStatus.set('12gl250', 0)
wedgesStatus.set('12gl300', 0)
wedgesStatus.set('nhandoi', 0)
wedgesStatus.set('cohoi', 0)
wedgesStatus.set('phanthuong', 0)
wedgesStatus.set('gl1million', 0)

function shuffleArray(array) {
  for (var i = array.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}

io.on('connection',(socket)=>{
  socket.emit('puzzleMode',puzzleMode)
  socket.emit('scoreboard',{})
  socket.emit('finalSpinMode',isFinalSpin)
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
    puzzle=data.puzzle
    solvedPuzzle=data.solved
    for(let i=0;i<56;i++){
      if(puzzle[i]=='') puzzleState[i]=0
      else if(puzzle[i]=='?'||puzzle[i]=='-'||puzzle[i]=='!'||puzzle[i]=='.'||puzzle[i]==','||puzzle[i]=="&"||puzzle[i]=='/') puzzleState[i]=3
      else puzzleState[i]=1
    }
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

  socket.on('revealPuzzle',()=>{
    io.emit('revealPuzzle',puzzle)
  })
  socket.on('reveal',(idx)=>{
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
  socket.on('solvePuzzle',()=>{
    socket.emit('stopAllSounds')
    socket.emit('playSound', '../sounds/chinhxac.mp3')
    console.log(solvedPuzzle)
    buzzed=[]
    io.emit('buzzersReset')
    let idxToOpen=[]
    for(let i=0;i<56;i++){
      if(puzzleState[i]==1) puzzleState[i]=3
      if(puzzleState[i]==3) idxToOpen.push(i)
    }
    io.emit('solvePuzzle',solvedPuzzle)
  })
  socket.on('solvePuzzleNoSound',()=>{
    buzzed=[]
    io.emit('buzzersReset')
    let idxToOpen=[]
    for(let i=0;i<56;i++){
      if(puzzleState[i]==1) puzzleState[i]=3
      if(puzzleState[i]==3) idxToOpen.push(i)
    }
    io.emit('solvePuzzle',solvedPuzzle)
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

  let currentRotation=0
  function getRandomInt(min, max) {
    const minCeiled = Math.ceil(min);
    const maxFloored = Math.floor(max);
    return Math.floor(Math.random() * (maxFloored - minCeiled) + minCeiled);
  }
  socket.on('spinWheel',()=>{
    currentRotation += getRandomInt(1080, 1440)
    if(isFinalSpin){
      io.emit('playSound', '../sounds/finalspin.mp3')
      io.emit('spinWheel', currentRotation,5)
    }
    else {
      io.emit('playSound', '../sounds/nhacquaynon.mp3')
      io.emit('spinWheel', currentRotation,8)
    }
  })
  socket.on('indicatePlayer', (player) => {
    io.emit('indicatePlayer', player)
  })
  socket.on('showWheel', round => {
    io.emit('showWheel', round)
  })

  socket.on('toggleWedge', (wedge) => {
    const currentStatus = wedgesStatus.get(wedge)
    wedgesStatus.set(wedge, !currentStatus)
    io.emit('toggleWedge', wedge, !currentStatus)
  })
})