const webSocketServerPort = 8000;
const webSocketServer = require('websocket').server;
const http = require('http');

const server = http.createServer()
server.listen(webSocketServerPort)
console.log('listening on port 8000')

const wsServer = new webSocketServer({
    httpServer: server
});

const clients = {}

const clientsToLobbies = {}

const lobbiesAndTheirClients = {}

const allGameState = {}

function makeid() {
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  
    for (var i = 0; i < 4; i++)
      text += possible.charAt(Math.floor(Math.random() * possible.length));
  
    return text;
}

const getUniqueID = () => {
    const s4 = () => Math.floor((1 +Math.random()) * 0x10000).toString(16).toString(1);
    return s4() + s4() + '-' + s4();
}

 

let shuffleArray = (array) => {
  let curId = array.length;
    // There remain elements to shuffle
    while (0 !== curId) {
      // Pick a remaining element
      let randId = Math.floor(Math.random() * curId);
      curId -= 1;
      // Swap it with the current element.
      let tmp = array[curId];
      array[curId] = array[randId];
      array[randId] = tmp;
    }
  return array;
}

const returnThreeQuestions = () => {
  let questionIndexSelected = []

  while(questionIndexSelected.length < 3){
    var r = Math.floor(Math.random() * questionsArray.length);
    if(questionIndexSelected.indexOf(r) === -1) questionIndexSelected.push(r);
  }

  let returnArray = [
    questionsArray[questionIndexSelected[0]],
    questionsArray[questionIndexSelected[1]],
    questionsArray[questionIndexSelected[2]],
  ]

    return(returnArray)
}

wsServer.on('request', function (request){
    var userID = getUniqueID();
    console.log((new Date())+' Recieved new connection from origin '+ request.origin + '.')

    const connection = request.accept(null, request.origin);
    clients[userID] = connection;
    console.log('connected: ' + userID + ' in ' + Object.getOwnPropertyNames(clients))

    //close server
    connection.on('close', function(request){
        let id = userID
        let lobby = clientsToLobbies[userID]

        if(lobbiesAndTheirClients[lobby]){
            lobbiesAndTheirClients[lobby] = lobbiesAndTheirClients[lobby].filter(item => item !== id)
        }
       

        if(lobby && allGameState[lobby].players !== undefined){
            console.log('attempt')

            let newPlayers = allGameState[lobby].players.filter(item => item.playerID !== id)
            delete allGameState[lobby].players
            allGameState[lobby].players = newPlayers
            
            lobbiesAndTheirClients[lobby].forEach((clientKey)=>{
                clients[clientKey].sendUTF(JSON.stringify({ type:'OTHER_PLAYER_ACTION', payload: allGameState[lobby] }));
            })

            if(lobbiesAndTheirClients[lobby].length == 0){
                delete lobbiesAndTheirClients[lobby]
            }
        }
        delete clientsToLobbies[lobby]
        delete clients[userID]

        if(lobby && allGameState[lobby].players.length === 0){
            delete allGameState[lobby]
        }
        console.log(allGameState)

    })

    connection.on('message', function(message) {
        if(message.type === 'utf8') {
            
            //Make A New Lobby And Add Player Who Created It
            if(JSON.parse(message.utf8Data).type=== 'makeNewLobby'){
                if(JSON.parse(message.utf8Data).userId === ''){
                    let newLobbyId = makeid();
                    
                    allGameState[newLobbyId] = {
                        players:[
                            {
                                playerID: userID,
                                playerName: JSON.parse(message.utf8Data).userName,
                                isImpostor: false,
                                isHost: true,
                                playerChoices: []
                            },
                        ]
                    }
                    clientsToLobbies[userID] = newLobbyId
                    lobbiesAndTheirClients[newLobbyId] = []
                    lobbiesAndTheirClients[newLobbyId].push(userID)

                    connection.sendUTF(JSON.stringify({ type:'STATE_UPDATE', payload: allGameState[newLobbyId], userId: userID, lobbyId: newLobbyId, playerName: JSON.parse(message.utf8Data).userName }));

                }
            }

            //Join An Existing Lobby
            if(JSON.parse(message.utf8Data).type === 'joinLobby'){
                if(JSON.parse(message.utf8Data).lobbyId){
                    let submittedLobbyId = JSON.parse(message.utf8Data).lobbyId.toUpperCase();

                    if(allGameState[submittedLobbyId]){
                        let newPlayer = {
                            playerID: userID,
                            playerName: JSON.parse(message.utf8Data).userName,
                            isImpostor: false,
                            isHost: false,
                            playerChoices: []
                        }

                        allGameState[submittedLobbyId].players.push(newPlayer)
                       
                        clientsToLobbies[userID] = submittedLobbyId
                        lobbiesAndTheirClients[submittedLobbyId].push(userID)

                        connection.sendUTF(JSON.stringify({ type:'STATE_UPDATE', payload: allGameState[submittedLobbyId], userId: newPlayer.playerID, lobbyId: submittedLobbyId, playerName: JSON.parse(message.utf8Data).userName }));

                        lobbiesAndTheirClients[submittedLobbyId].forEach((clientKey)=>{
                            clients[clientKey].sendUTF(JSON.stringify({ type:'OTHER_PLAYER_ACTION', payload: allGameState[submittedLobbyId] }));
                        })
                    }else{
                        connection.sendUTF(JSON.stringify({ type:'ERROR', payload: 'Could Not Join Lobby' }));
                    }
                }
            }

            //Start Game
            if(JSON.parse(message.utf8Data).type === 'startTheGame'){
                if(JSON.parse(message.utf8Data).lobbyId){
                    let submittedLobbyId = JSON.parse(message.utf8Data).lobbyId.toUpperCase();

                    if(allGameState[submittedLobbyId]){
                        
                        let threeQuestons = returnThreeQuestions()
                        let stageOfTheGame = 1
                        let directionsToPlayersTakeAction = 'write an answer'
                        let directionsToPlayersAfterAction='Wait for other players to answer'
                        let questionsAndAnswers = [
                            {
                                questionNumber: 1,
                                question: threeQuestons[0].question,
                                answer: threeQuestons[0].answer,
                                category: threeQuestons[0].category,
                                playerAnswers: {}
                            },
                            {
                                questionNumber: 2,
                                question: threeQuestons[1].question,
                                answer: threeQuestons[1].answer,
                                category: threeQuestons[1].category,
                                playerAnswers: {}
                            },
                            {
                                questionNumber: 3,
                                question: threeQuestons[2].question,
                                answer: threeQuestons[2].answer,
                                category: threeQuestons[2].category,
                                playerAnswers: {}
                            },
                        ]

                        let impostorIndex = Math.floor(Math.random() * allGameState[submittedLobbyId].players.length );
                        
                        let newPlayerArray = allGameState[submittedLobbyId].players
                        newPlayerArray[impostorIndex].isImpostor = true
                        let newChallengerArray = [...shuffleArray(challengersArray)]

                        let arraySectionStart = 0
                        newPlayerArray.map((player)=>{
                            let playerChallengers = newChallengerArray.slice(arraySectionStart, arraySectionStart + 5)
                            player.playerChoices = [...playerChallengers]
                            arraySectionStart = arraySectionStart + 5
                            return player
                        })

                        delete allGameState[submittedLobbyId].players

                        allGameState[submittedLobbyId].players = newPlayerArray
                        allGameState[submittedLobbyId].impostorId = newPlayerArray[impostorIndex].playerID
                        allGameState[submittedLobbyId].votesForImpostor = []
                        allGameState[submittedLobbyId].votesForImpostorWithVoter = []

                        allGameState[submittedLobbyId].stageOfTheGame = stageOfTheGame
                        allGameState[submittedLobbyId].directionsToPlayersAfterAction = directionsToPlayersAfterAction
                        allGameState[submittedLobbyId].directionsToPlayersTakeAction = directionsToPlayersTakeAction
                        allGameState[submittedLobbyId].questionsAndAnswers = questionsAndAnswers

                        connection.sendUTF(JSON.stringify({ type:'GAME_STARTING' }));

                        lobbiesAndTheirClients[submittedLobbyId].forEach((clientKey)=>{
                            clients[clientKey].sendUTF(JSON.stringify({ type:'GAME_STARTING' }));
                        })

                        let returnGameState = allGameState[submittedLobbyId]
                       
                        lobbiesAndTheirClients[submittedLobbyId].forEach((clientKey) => {
                            clients[clientKey].sendUTF(JSON.stringify({ type:'OTHER_PLAYER_ACTION', payload: allGameState[submittedLobbyId] }));
                        })

                    }else{
                        connection.sendUTF(JSON.stringify({ type:'ERROR', payload: 'Could Not Start Game' }));
                    }
                }
            }

            //Give Game State Update
            if(JSON.parse(message.utf8Data).type === 'giveStateUpdate'){
                if(JSON.parse(message.utf8Data).lobbyId){
                    let submittedLobbyId = JSON.parse(message.utf8Data).lobbyId.toUpperCase();

                    if(allGameState[submittedLobbyId]){
                        
                        let returnGameState = allGameState[submittedLobbyId]
                       
                        connection.sendUTF(JSON.stringify({ type:'STATE_UPDATE', payload: returnGameState }));

                    }else{
                        connection.sendUTF(JSON.stringify({ type:'ERROR', payload: 'Could Not find lobby' }));
                    }
                }
            }

            //Submit Answer
            if(JSON.parse(message.utf8Data).type === 'submitAnswer'){
                if(JSON.parse(message.utf8Data).lobbyId){
                    let submittedLobbyId = JSON.parse(message.utf8Data).lobbyId.toUpperCase();
                    let playerId = JSON.parse(message.utf8Data).playerId;
                    let stageOfTheGame = JSON.parse(message.utf8Data).stageOfTheGame;
                    let submittedAnswer = JSON.parse(message.utf8Data).submittedAnswer;
                    let playerName = JSON.parse(message.utf8Data).playerName;
                    if(allGameState[submittedLobbyId]){

                        allGameState[submittedLobbyId].questionsAndAnswers[stageOfTheGame - 1].playerAnswers[playerId] = {answer: submittedAnswer, playerName: playerName} 

                        let numberOfSubmittedAnswers = 0
                        let numberOfPlayers = allGameState[submittedLobbyId].players.length
                        for(const key in allGameState[submittedLobbyId].questionsAndAnswers[stageOfTheGame - 1].playerAnswers) {
                            numberOfSubmittedAnswers++
                        }
                        if(numberOfSubmittedAnswers >= numberOfPlayers ){
                            allGameState[submittedLobbyId].stageOfTheGame = allGameState[submittedLobbyId].stageOfTheGame+1//advance state of game

                            lobbiesAndTheirClients[submittedLobbyId].forEach((clientKey) => {
                                clients[clientKey].sendUTF(JSON.stringify({ type:'SET_A_TIMEOUT', payload: {message: ''} }));
                            })
                        }

                        connection.sendUTF(JSON.stringify({ type:'STATE_UPDATE', payload: allGameState[submittedLobbyId] }));

                        lobbiesAndTheirClients[submittedLobbyId].forEach((clientKey) => {
                            clients[clientKey].sendUTF(JSON.stringify({ type:'OTHER_PLAYER_ACTION', payload: allGameState[submittedLobbyId] }));
                        })

                    }else{
                        connection.sendUTF(JSON.stringify({ type:'ERROR', payload: 'Could Not Submit Answer' }));
                    }
                }
            }

            //restart game
            if(JSON.parse(message.utf8Data).type === 'restart game'){
                if(JSON.parse(message.utf8Data).lobbyId){
                    let submittedLobbyId = JSON.parse(message.utf8Data).lobbyId.toUpperCase();
                    let playerId = JSON.parse(message.utf8Data).playerId;
                    let submittedVote = JSON.parse(message.utf8Data).submittedVote;
                    if(allGameState[submittedLobbyId]){
                        
                        let impostorIndex = Math.floor(Math.random() * allGameState[submittedLobbyId].players.length );
                        
                        let newPlayerArray = allGameState[submittedLobbyId].players
                        newPlayerArray[impostorIndex].isImpostor = true

                    }else{
                        connection.sendUTF(JSON.stringify({ type:'ERROR', payload: 'could not restart' }));
                    }
                }
            }

            //Submit Vote For Impostor
            if(JSON.parse(message.utf8Data).type === 'voteForImpostor'){
                if(JSON.parse(message.utf8Data).lobbyId){
                    let submittedLobbyId = JSON.parse(message.utf8Data).lobbyId.toUpperCase();
                    let playerId = JSON.parse(message.utf8Data).playerId;
                    let submittedVote = JSON.parse(message.utf8Data).submittedVote;
                    if(allGameState[submittedLobbyId]){

                        allGameState[submittedLobbyId].votesForImpostor.push(submittedVote)
                        allGameState[submittedLobbyId].votesForImpostorWithVoter.push({playerId: playerId, votedFor:submittedVote})

                        connection.sendUTF(JSON.stringify({ type:'STATE_UPDATE', payload: allGameState[submittedLobbyId] }));

                        lobbiesAndTheirClients[submittedLobbyId].forEach((clientKey) => {
                            clients[clientKey].sendUTF(JSON.stringify({ type:'OTHER_PLAYER_ACTION', payload: allGameState[submittedLobbyId] }));
                        })

                    }else{
                        connection.sendUTF(JSON.stringify({ type:'ERROR', payload: 'Could Not Submit Vote' }));
                    }
                }
            }
            
        }
    });

})

const challengersArray = [
    'Clifford the Big Red Dog',
    'Christopher Columbus',
    'The Pope',
    'Kim Kardashian',
    'Logan Paul',
    'Helen Keller',
    'Superman',
    'Taylor Swift',
    'Joseph Stalin',
    'Lebron James',
    'Albert Einstin',
    'George Washington',
    'Mr Beast',
    'Paul Bunion',
    'Harambe the Gorilla',
    'Leonardo Decaprio',
    'Abraham Lincoln',
    'arnold schwarzenegger',
    'Jason Vorhees',
    'Harry Potter',
    'Micheal Jackson',
    'Flipper the dolphin',
    'Tiger Woods',
    'Jack Sparrow',
    'Hulk Hogan',
    'James Bond',
    'Sasquatch',
    'Queen Elizabeth',
    'Sherlock Holmes',
    'Dr Phil',
    'Dracula',
    'Gengis Khan',
    'Elon Musk',
    'Gordon Ramsey',
    'Ted Bundy',
    'Vladimir Putin',
    'Payton Manning',
    'Sacajuea',
    'Justin Beiber',
    'Jackie chan',
    'me',
    'My mom',
    'My dad',
    'my grandma',
    'My grandpa',
    'Luke Skywalker',
    'Ghandi',
    'The insane clown posse',
    'Dr Frankenstein',
    'Tony Saprano',
    'Batman',
    'Mike Tyson',
    'Amadaeus Mozart',
    'William Shakespear',
    'Neil Armtrong',
    'Jesus Christ',
    'Tom Sawyer',
    'Al Capone',
    'Kanye West',
    'Usain Bolt',
    'Tekashi 69',
    'Bigfoot',
    'Air bud',
    'Billy the kid',
    'smokey the bear',
    'the hamburgler',
    'Billey Eilish',
    'ebinezier scrouge',
    'Elmo',
    'Homer simpson',
    'kids birthday clown',
    'Moses',
    'Stephen king',
    'Thomas Edison',
    'E.T',
    'My significant other',
    'Shrek',
    'Paul Blart Mall Cop',
    'Mufasa',
    'The Joker',
    'Zeus',
    'Hercules',
    'Mary Poppins',
]

const questionsArray = [
    {
        question: 'Win a rap battle',
        category: '',
        answer: '',
    },
    {
        question: 'Drink the most Vodka',
        category: '',
        answer: '',
    },
    {
        question: 'Win a Boxing match',
        category: '',
        answer: '',
    },
    {
        question: 'Be the best therapist',
        category: '',
        answer: '',
    },
    {
        question: 'Slay a vampire',
        category: '',
        answer: '',
    },
    {
        question: 'win a presidential race',
        category: '',
        answer: '',
    },
    {
        question: 'Best Sumo Wrestler',
        category: '',
        answer: '',
    },
    {
        question: 'Best Secret agent',
        category: '',
        answer: '',
    },
    {
        question: 'Win a hotdog eating contest',
        category: '',
        answer: '',
    },
    {
        question: 'Win a beauty pagent',
        category: '',
        answer: '',
    },
    {
        question: 'Win a marathon',
        category: '',
        answer: '',
    },
    {
        question: 'Bake the best cake',
        category: '',
        answer: '',
    },
    {
        question: 'Jump the highest',
        category: '',
        answer: '',
    },
    {
        question: 'Win a game of Chess',
        category: '',
        answer: '',
    },
    {
        question: 'rescue a drowning swimmer',
        category: '',
        answer: '',
    },
    {
        question: 'Assassinate the president',
        category: '',
        answer: '',
    },
    {
        question: 'Win go carts at chuck e cheese',
        category: '',
        answer: '',
    },
    {
        question: 'negotiate peace between israel and Palestine',
        category: '',
        answer: '',
    },
    {
        question: 'fit the most marshmallows in their mouth',
        category: '',
        answer: '',
    },
    {
        question: 'win the tour de france',
        category: '',
        answer: '',
    },
    {
        question: 'Be the best therapist',
        category: '',
        answer: '',
    },
    {
        question: 'Slay a vampire',
        category: '',
        answer: '',
    },
    {
        question: 'Run a fortune 500 company',
        category: '',
        answer: '',
    },
    {
        question: 'win a presidential race',
        category: '',
        answer: '',
    },
    {
        question: 'strongest arm wrestler',
        category: '',
        answer: '',
    },
    {
        question: 'most likes on instagram',
        category: '',
        answer: '',
    },
    {
        question: 'Hide from the cops the longest',
        category: '',
        answer: '',
    },
    {
        question: 'Best Romantic Partner',
        category: '',
        answer: '',
    },
    {
        question: 'Win a game of golf',
        category: '',
        answer: '',
    },
    {
        question: 'Best Pro Wrestler',
        category: '',
        answer: '',
    },
    {
        question: 'Best role model for children',
        category: '',
        answer: '',
    },
    {
        question: 'get their idea funded on shark tank',
        category: '',
        answer: '',
    },
    {
        question: 'Be the best Roommate',
        category: '',
        answer: '',
    },
    {
        question: 'Best at medieval jousting',
        category: '',
        answer: '',
    },
    {
        question: 'Win American Idol',
        category: '',
        answer: '',
    },
    {
        question: 'Win a triathlon',
        category: '',
        answer: '',
    },
    {
        question: 'Sell the most girl scout cookies',
        category: '',
        answer: '',
    },
    {
        question: 'Best first grade teacher',
        category: '',
        answer: '',
    },
    {
        question: 'survive in the wilderness the longest',
        category: '',
        answer: '',
    },
    {
        question: 'Best broadway performance',
        category: '',
        answer: '',
    },
    {
        question: 'Best zombie apocalypse survivor',
        category: '',
        answer: '',
    },
    {
        question: 'Best movie villain',
        category: '',
        answer: '',
    },
    {
        question: 'Win a talent show',
        category: '',
        answer: '',
    },
    {
        question: 'Win an Esports tournament',
        category: '',
        answer: '',
    },
    {
        question: 'Wildest outlaw',
        category: '',
        answer: '',
    },
    {
        question: 'best boss',
        category: '',
        answer: '',
    },
    {
        question: 'Best standup comedian',
        category: '',
        answer: '',
    },
    {
        question: 'best astronaut',
        category: '',
        answer: '',
    },
    {
        question: 'Wait on 10 tables at once',
        category: '',
        answer: '',
    },
    {
        question: 'live the longest',
        category: '',
        answer: '',
    },
    {
        question: 'most ruthless gangster',
        category: '',
        answer: '',
    },
    {
        question: 'Best breakfast cereal mascot',
        category: '',
        answer: '',
    },
    {
        question: 'Powerlifting',
        category: '',
        answer: '',
    },
    {
        question: 'Most matches on tinder',
        category: '',
        answer: '',
    },
    {
        question: 'best public speaker',
        category: '',
        answer: '',
    },
    {
        question: 'Solve a cold case murder',
        category: '',
        answer: '',
    },
    {
        question: 'be completely useless',
        category: '',
        answer: '',
    },
    {
        question: 'read the most books in one day',
        category: '',
        answer: '',
    },
    {
        question: 'most emotionally manipulative',
        category: '',
        answer: '',
    },
    {
        question: 'Best haunted house actor',
        category: '',
        answer: '',
    },
    {
        question: 'Best child birthday party entertainer',
        category: '',
        answer: '',
    },
    {
        question: 'best highschool teacher',
        category: '',
        answer: '',
    },
    {
        question: 'worst babysitter',
        category: '',
        answer: '',
    },
    {
        question: 'be the coolest action figure',
        category: '',
        answer: '',
    },
    {
        question: 'best at keeping a secret',
        category: '',
        answer: '',
    },
    {
        question: 'best kisser',
        category: '',
        answer: '',
    },
    {
        question: 'character you love to hate',
        category: '',
        answer: '',
    },
    {
        question: 'roll the dankest blunt',
        category: '',
        answer: '',
    },
    {
        question: 'toss a dwarf the farthest',
        category: '',
        answer: '',
    },
    {
        question: 'host the best podcast',
        category: '',
        answer: '',
    },
    {
        question: 'best dunegon master',
        category: '',
        answer: '',
    },
    {
        question: 'best guardian angel',
        category: '',
        answer: '',
    },
    {
        question: 'Biggest drama queen',
        category: '',
        answer: '',
    },
    {
        question: 'most likley to be a serial killer',
        category: '',
        answer: '',
    },
    {
        question: 'Most Twitter followers',
        category: '',
        answer: '',
    },
    {
        question: 'fight to the death',
        category: '',
        answer: '',
    },
    {
        question: 'best prom date',
        category: '',
        answer: '',
    },
    
]