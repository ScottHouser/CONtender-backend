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

const questionsArray = [
    {
        question: 'Which videogame sold the most copies ever',
        category: 'video game',
        answer: 'Minecraft',
    },
    {
        question: 'Which olympic sport did the Philippines win their only gold medal',
        category: 'olympic sport',
        answer: 'weight lifting',
    },
    {
        question: 'Which actor plays himself in the film Zombieland',
        category: 'Actor',
        answer: 'Bill Murry',
    },
    {
        question: 'Which land mammal can\'\t jump',
        category: 'land mammal',
        answer: 'elephand',
    },
    {
        question: 'which animal has the most powerful bite',
        category: 'animal',
        answer: 'hippopotamus',
    },
    {
        question: 'which country is pop star Shakira from',
        category: 'country',
        answer: 'Columbia',
    },
    {
        question: 'Which country does gouda cheese come from',
        category: 'country',
        answer: 'Netherlands',
    },
    {
        question: 'What year was Nepoleon defeated at Waterloo',
        category: 'year',
        answer: '1815',
    },
    {
        question: 'Which US president had the middle name "Millhouse"',
        category: 'US president',
        answer: 'Richard Nixon',
    },
    {
        question: 'Which famous rapper says "Smoke weed every day."',
        category: 'rapper',
        answer: 'Snoop Dog',
    },
    {
        question: 'What food is the national dish of England',
        category: 'food',
        answer: 'Chicken Tika Masala',
    },
]

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
                console.log('make a New Lobby')
                if(JSON.parse(message.utf8Data).userId === ''){
                    console.log('makeNewLobbyGO')
                    let newLobbyId = makeid();
                    
                    allGameState[newLobbyId] = {
                        players:[
                            {
                                playerID: userID,
                                playerName: JSON.parse(message.utf8Data).userName,
                                isImpostor: false,
                                isHost: true,
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
                console.log('add player to lobby')
                if(JSON.parse(message.utf8Data).lobbyId){
                    let submittedLobbyId = JSON.parse(message.utf8Data).lobbyId.toUpperCase();

                    if(allGameState[submittedLobbyId]){
                        let newPlayer = {
                            playerID: userID,
                            playerName: JSON.parse(message.utf8Data).userName,
                            isImpostor: false,
                            isHost: false,
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
                console.log('-')
                if(JSON.parse(message.utf8Data).lobbyId){
                    let submittedLobbyId = JSON.parse(message.utf8Data).lobbyId.toUpperCase();

                    if(allGameState[submittedLobbyId]){
                        
                        let threeQuestons = returnThreeQuestions()
                        console.log(threeQuestons)
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
                        delete allGameState[submittedLobbyId].players

                        allGameState[submittedLobbyId].players = newPlayerArray
                        allGameState[submittedLobbyId].impostorId = newPlayerArray[impostorIndex].playerID
                        allGameState[submittedLobbyId].votesForImpostor = []

                        allGameState[submittedLobbyId].stageOfTheGame = stageOfTheGame
                        allGameState[submittedLobbyId].directionsToPlayersAfterAction = directionsToPlayersAfterAction
                        allGameState[submittedLobbyId].directionsToPlayersTakeAction = directionsToPlayersTakeAction
                        allGameState[submittedLobbyId].questionsAndAnswers = questionsAndAnswers

                        connection.sendUTF(JSON.stringify({ type:'GAME_STARTING' }));

                        lobbiesAndTheirClients[submittedLobbyId].forEach((clientKey)=>{
                            clients[clientKey].sendUTF(JSON.stringify({ type:'GAME_STARTING' }));
                        })

                    }else{
                        connection.sendUTF(JSON.stringify({ type:'ERROR', payload: 'Could Not Start Game' }));
                    }
                }
            }

            //Give Game State Update
            if(JSON.parse(message.utf8Data).type === 'giveStateUpdate'){
                console.log('-')
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
                console.log('SUBMIT ANSWER')
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
                            console.log('Increment Stage of the game')
                            allGameState[submittedLobbyId].stageOfTheGame = allGameState[submittedLobbyId].stageOfTheGame+1

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

            //Submit Vote For Impostor
            if(JSON.parse(message.utf8Data).type === 'voteForImpostor'){
                console.log('SUBMIT VOTE')
                if(JSON.parse(message.utf8Data).lobbyId){
                    let submittedLobbyId = JSON.parse(message.utf8Data).lobbyId.toUpperCase();
                    let playerId = JSON.parse(message.utf8Data).playerId;
                    let submittedVote = JSON.parse(message.utf8Data).submittedVote;
                    if(allGameState[submittedLobbyId]){
                        
                        allGameState[submittedLobbyId].votesForImpostor.push(submittedVote)

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