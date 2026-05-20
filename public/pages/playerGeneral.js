let isZoomedIn=false

socket.on('buzzersReset', () => {
  $('#p1Slot').css('background', 'black')
  $('#p2Slot').css('background', 'black')
  $('#p3Slot').css('background', 'black')
  $('#buzzer').text('Chuông')
  $('#buzzer').prop('disabled', true)
})
socket.on('enableBuzzers', () => {
  $('#buzzer').prop('disabled', false)
})
socket.on('bonusTime', (time) => {
  $('#buzzer').text(time)
})
socket.on('buzzed', (data) => {
  if (data == 1) {
    $('#p1Slot').css('background', 'red')
  }
  else if (data == 2) {
    $('#p2Slot').css('background', 'yellow')
  }
  else if (data == 3) {
    $('#p3Slot').css('background', 'blue')
  }
})
socket.on('scoreboard', (data) => {
  $('#p1Slot p:nth-child(1)').text(data.p1.name);
  $('#p2Slot p:nth-child(1)').text(data.p2.name);
  $('#p3Slot p:nth-child(1)').text(data.p3.name);
  $('#p1Slot p:nth-child(2)').text(data.p1.score);
  $('#p2Slot p:nth-child(2)').text(data.p2.score);
  $('#p3Slot p:nth-child(2)').text(data.p3.score);
});

$('#p1Name').hover(() => {
  $('#wheelWeb').addClass('zoomedInP1')
})
$('#p1Name').mouseleave(() => {
  $('#wheelWeb').removeClass('zoomedInP1')
})
$('#p2Name').hover(() => {
  $('#wheelWeb').addClass('zoomedInP2')
})
$('#p2Name').mouseleave(() => {
  $('#wheelWeb').removeClass('zoomedInP2')
})
$('#p3Name').hover(() => {
  $('#wheelWeb').addClass('zoomedInP3')
})
$('#p3Name').mouseleave(() => {
  $('#wheelWeb').removeClass('zoomedInP3')
})

$('#spin').click(() => {
  socket.emit('spinWheel')
})
