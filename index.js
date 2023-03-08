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
       

        if(lobby && allGameState[lobby]?.players !== undefined){
            console.log('attempt')

            let newPlayers = allGameState[lobby].players.filter(item => item.playerID !== id)
            delete allGameState[lobby].players
            allGameState[lobby].players = newPlayers
            
            lobbiesAndTheirClients[lobby].forEach((clientKey)=>{
                clients[clientKey].sendUTF(JSON.stringify({ type:'OTHER_PLAYER_ACTION', payload: allGameState[lobby] }));
            })

            lobbiesAndTheirClients[lobby].forEach((clientKey)=>{
                clients[clientKey].sendUTF(JSON.stringify({ type:'LOBBY_CLOSED', payload: allGameState[lobby] }));
            })

            //if(lobbiesAndTheirClients[lobby].length == 0){
                delete lobbiesAndTheirClients[lobby]
            //}
        }
        delete clientsToLobbies[lobby]
        delete clients[userID]

        //if(lobby && allGameState[lobby].players.length === 0){
            delete allGameState[lobby]
        //}
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
                        ],
                        gameHasStarted: false
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

                    if(allGameState[submittedLobbyId] && lobbiesAndTheirClients[submittedLobbyId].length < 7 && allGameState[submittedLobbyId].gameHasStarted === false){
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
                        allGameState[submittedLobbyId].gameHasStarted = true

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
    'The Pope',
    'Kim Kardashian',
    'Helen Keller',
    'Superman',
    'Taylor Swift',
    'Lebron James',
    'Albert Einstein',
    'George Washington',
    'Harambe the Gorilla',
    'Leonardo Dicaprio',
    'Abraham Lincoln',
    'Harry Potter',
    'Michael Jackson',
    'Flipper the Dolphin',
    'Jack Sparrow',
    'James Bond',
    'Sasquatch',
    'Queen Elizabeth',
    'Sherlock Holmes',
    'Dracula',
    'Genghis Khan',
    'Elon Musk',
    'Vladimir Putin',
    'Peyton Manning',
    'Pocahontas',
    'Justin Bieber',
    'Joseph Stalin',
    'Mr Beast',
    'Paul Bunyan',
    'Jason Voorhees',
    'Tiger Woods',
    'Hulk Hogan',
    'Dr Phil',
    'Gordon Ramsay',
    'Christopher Columbus',
    'Ted Bundy',
    'Jackie Chan',
    'Logan Paul',
    'Me',
    'My mom',
    'My dad',
    'My grandma',
    'My grandpa',
    'Luke Skywalker',
    'Gandhi',
    'The Insane Clown Posse',
    'Dr Frankensteins Monster',
    'Tony Soprano',
    'Batman',
    'Amadeus Mozart',
    'William Shakespeare',
    'Joan of Arc',
    'Tom Sawyer',
    'Al Capone',
    'Kanye West',
    'Usain Bolt',
    'Mike Tyson',
    'Neil Armstrong',
    'Tekashi69',
    'Bigfoot',
    'Air Bud',
    'Billy the Kid',
    'Smokey the Bear',
    'The Hamburglar',
    'Billie Eilish',
    'Ebenezer Scrooge',
    'Moses',
    'Stephen King',
    'Thomas Edison',
    'E.T.',
    'Mufasa',
    'Elmo',
    'Homer Simpson',
    'Kids Birthday Clown',
    'My significant other',
    'Shrek',
    'Paul Blart Mall Cop',
    'The Joker',
    'Air Bud',
    'Hercules',
    'Captain Crunch',
    'King Arthur',
    'Captain America',
    'Willy Wonka',
    'Peter Pan',
    'Godzilla',
    'Barbie',
    'Tarzan',
    'Mary Poppins',
    'Aristotle',
    'Karl Marx',
    'Julius Caesar',
    'Sigmund Freud',
    'Edgar Allan Poe',
    'Robert E. Lee',
    'Ben Shapiro',
    'Jon Snow',
    'The Hulk',
    'Eric Cartman',
    'Walter White',
    'Goku',
    'Bilbo Baggins',
    'Tupac Shakur',
    'Optimus Prime',
    'Beyonce',
    'Donald Trump',
    'Dwayne "The Rock"Johnson',
    'Judas',
    'Sonic the Hedgehog',
    'The Terminator',
    'Kermit the Frog',
    'Donkey Kong',
    'Bill Cosby',
    'Black Beard',
    'Grumpy Cat',
    'Bambi',
    'Garfield',
    'Mickey Mouse',
    'Jeff Bezos',
    'Mark Zuckerberg',
    'Santa Claus',
    'Bill Gates',
    'Thor',
    'Joe Biden',
    'Jeffrey Epstein',
    'Mother Teresa',
    'Tony Hawk',
    'An Alligator',
    'An Elephant',
    'A Tree',
    'Rasputin',
    'Alvin and the Chipmunks',
    'A Navy Seal',
    'K-Pop Star',
    'A wizard',
    'A german shepard',
    'The average American',
    'A Rabbi',
    'The average Canadian',
    'McGruff the Crime Dog',
    'A Buddhist Monk',
    'Satan',
    'Jesus Christ',
    'Robin Hood',
    'Osama Bin Laden',
    'Medieval Knight',
    'Homeless Guy',
    'The Person to my right',
    'The Person to my Left',
    'New York City cop',
    'Tik Tok Influencer',
    'Swedish Chef',
    'Harry Houdini',
    'A Baby',
    'Basement Dwelling Nerd',
    'Andy Warhol',
    'Leonardo Da Vinci',
    'Mark Wahlberg',
    'Waldo',
    'Elvis Presley',
    'Winnie The Pooh',
    'A dragon',
    'Buzz Lightyear',
    'Spiderman',
    'Your Neighbor',
    'Dr. Jekyll And Mr. Hyde',
    'Darth Vader',
    'Borat',
    'Scooby Doo',
    'The Mailman',
    'Will Smith',
    'Your second grade teacher',
    'A fry cook',
    'Infomercial salesman',
    'A colony of ants',
    'Street Preacher',
    'Lawyer',
    'Hacker',
    'A blue collar worker',
    'Winston Churchill',
    'A Roomba',
    'Guy Fieri',
    'Seeing Eye Dog',
    'Emotional Support Hamster',
    'My imaginary friend',
    'Boy Scout',
    'Carnival Worker',
    'Matt Damon',
    'Alex Jones',
    'Cristiano Ronaldo',
    'Michael Scott',
    'Steve Irwin',
    'Christopher Lee',
    'Anderson Cooper',
    'Hunter S. Thompson',
    'Marie Antoinette',
    'Vlad the Impaler',
    'Pamela Anderson',
    'Guy Fieri',
    'Voldemort',
    'Weird Al Yankovic',
    'King Leonidas',
    'Babe Ruth',
    'Tom Brady',
    'Thomas the Tank Engine',
    'The headless horseman',
    'Amazon Alexa',
    'Two kids in a trenchcoat',
    'Hugh Hefner',
    'Theodore Roosevelt',
    'Rocky Balboa',
    'Austin Powers',
    'Bear Grylls',
    'Jerry Seinfeld',
    'The Dalai Lama',
    'A Cowboy',
    'Harry Houdini',
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
    {
        question: 'best getaway driver',
        category: '',
        answer: '',
    },
    {
        question: 'best poker face',
        category: '',
        answer: '',
    },
    {
        question: 'Assemble an Ikea sofa',
        category: '',
        answer: '',
    },
    {
        question: 'Endure torture the longest',
        category: '',
        answer: '',
    },
    {
        question: 'Throw the best party',
        category: '',
        answer: '',
    },
    {
        question: 'Plan the most epic betrayal',
        category: '',
        answer: '',
    },
    {
        question: 'Sell out the fastest',
        category: '',
        answer: '',
    },
    {
        question: 'Talk the most trash',
        category: '',
        answer: '',
    },
    {
        question: 'Seduce you',
        category: '',
        answer: '',
    },
    {
        question: 'Negotiate the release of a hostage',
        category: '',
        answer: '',
    },
    {
        question: 'First to show up at a party',
        category: '',
        answer: '',
    },
    {
        question: 'Have the lowest standards',
        category: '',
        answer: '',
    },
    {
        question: 'Get bullied in highschool',
        category: '',
        answer: '',
    },
    {
        question: 'Make friends in prison',
        category: '',
        answer: '',
    },
    {
        question: 'Solve world hunger',
        category: '',
        answer: '',
    },
    {
        question: 'Best shoulder to cry on',
        category: '',
        answer: '',
    },
    {
        question: 'Smell the best',
        category: '',
        answer: '',
    },
    {
        question: 'Survive a gunshot',
        category: '',
        answer: '',
    },
    {
        question: 'Best little league coach',
        category: '',
        answer: '',
    },
    {
        question: 'Best for the environment',
        category: '',
        answer: '',
    },
    {
        question: 'Beat "Dark Souls"',
        category: '',
        answer: '',
    },
    {
        question: 'Survive the D day landing',
        category: '',
        answer: '',
    },
    {
        question: 'Perform the Superbowl halftime show',
        category: '',
        answer: '',
    },
    {
        question: 'Have the fewest friends',
        category: '',
        answer: '',
    },
    {
        question: 'Pass a college level calculus class',
        category: '',
        answer: '',
    },
    {
        question: 'Solve an escape room',
        category: '',
        answer: '',
    },
    {
        question: 'Conjure the devil',
        category: '',
        answer: '',
    },
    {
        question: 'Write a best selling book',
        category: '',
        answer: '',
    },
    {
        question: 'Win the nobel peace prize',
        category: '',
        answer: '',
    },
    {
        question: 'Go to heaven',
        category: '',
        answer: '',
    },
    {
        question: 'Go to hell',
        category: '',
        answer: '',
    },
    {
        question: 'Lose all their money',
        category: '',
        answer: '',
    },
    {
        question: 'Dodge the draft',
        category: '',
        answer: '',
    },
    {
        question: 'Have the best excuse for not showing up to work',
        category: '',
        answer: '',
    },
    {
        question: 'Just be happy',
        category: '',
        answer: '',
    },
    {
        question: 'I want to meet them',
        category: '',
        answer: '',
    },
    {
        question: 'Best door to door salesman',
        category: '',
        answer: '',
    },
    {
        question: 'Heckle a comedy show',
        category: '',
        answer: '',
    },
    {
        question: 'Wrestle an Alligator',
        category: '',
        answer: '',
    },
    {
        question: 'Get canceled',
        category: '',
        answer: '',
    },
    {
        question: 'Go "Goblin Mode"',
        category: '',
        answer: '',
    },
    {
        question: 'Become mayor of Flavortown',
        category: '',
        answer: '',
    },
    {
        question: 'Just be normal',
        category: '',
        answer: '',
    },
    {
        question: 'Best substitute teacher',
        category: '',
        answer: '',
    },
    {
        question: 'Have the shortest lifespan',
        category: '',
        answer: '',
    },
    {
        question: 'Catch a greased up hog',
        category: '',
        answer: '',
    },
    {
        question: 'Rob a bank',
        category: '',
        answer: '',
    },
]


// 'Clifford the Big Red Dog',
// 'The Pope',
// 'Kim Kardashian',
// 'Helen Keller',
// 'Superman',
// 'Taylor Swift',
// 'Lebron James',
// 'Albert Einstein',
// 'George Washington',
// 'Harambe the Gorilla',
// 'Leonardo Dicaprio',
// 'Abraham Lincoln',
// 'Harry Potter',
// 'Michael Jackson',
// 'Flipper the Dolphin',
// 'Jack Sparrow',
// 'James Bond',
// 'Sasquatch',
// 'Queen Elizabeth',
// 'Sherlock Holmes',
// 'Dracula',
// 'Genghis Khan',
// 'Elon Musk',
// 'Vladimir Putin',
// 'Peyton Manning',
// 'Pocahontas',
// 'Justin Bieber',
// 'Joseph Stalin',
// 'Mr Beast',
// 'Paul Bunyan',
// 'Jason Voorhees',
// 'Tiger Woods',
// 'Hulk Hogan',
// 'Dr Phil',
// 'Gordon Ramsay',
// 'Christopher Columbus',
// 'Ted Bundy',
// 'Jackie Chan',
// 'Logan Paul',
// 'Me',
// 'My mom',
// 'My dad',
// 'My grandma',
// 'My grandpa',
// 'Luke Skywalker',
// 'Gandhi',
// 'The Insane Clown Posse',
// 'Dr Frankensteins Monster',
// 'Tony Soprano',
// 'Batman',
// 'Amadeus Mozart',
// 'William Shakespeare',
// 'Joan of Arc',
// 'Tom Sawyer',
// 'Al Capone',
// 'Kanye West',
// 'Usain Bolt',
// 'Mike Tyson',
// 'Neil Armstrong',
// 'Tekashi69',
// 'Bigfoot',
// 'Air Bud',
// 'Billy the Kid',
// 'Smokey the Bear',
// 'The Hamburglar',
// 'Billie Eilish',
// 'Ebenezer Scrooge',
// 'Moses',
// 'Stephen King',
// 'Thomas Edison',
// 'E.T.',
// 'Mufasa',
// 'Elmo',
// 'Homer Simpson',
// 'Kids Birthday Clown',
// 'My significant other',
// 'Shrek',
// 'Paul Blart Mall Cop',
// 'The Joker',
// 'Air Bud',
// 'Hercules',
// 'Captain Crunch',
// 'King Arthur',
// 'Captain America',
// 'Willy Wonka',
// 'Peter Pan',
// 'Godzilla',
// 'Barbie',
// 'Tarzan',
// 'Mary Poppins',
// 'Aristotle',
// 'Karl Marx',
// 'Julius Caesar',
// 'Sigmund Freud',
// 'Edgar Allan Poe',
// 'Robert E. Lee',
// 'Ben Shapiro',
// 'Jon Snow',
// 'The Hulk',
// 'Eric Cartman',
// 'Walter White',
// 'Goku',
// 'Bilbo Baggins',
// 'Tupac Shakur',
// 'Optimus Prime',
// 'Beyonce',
// 'Donald Trump',
// 'Dwayne "The Rock"Johnson',
// 'Judas',
// 'Sonic the Hedgehog',
// 'The Terminator',
// 'Kermit the Frog',
// 'Donkey Kong',
// 'Bill Cosby',
// 'Black Beard',
// 'Grumpy Cat',
// 'Bambi',
// 'Garfield',
// 'Mickey Mouse',
// 'Jeff Bezos',
// 'Mark Zuckerberg',
// 'Santa Claus',
// 'Bill Gates',
// 'Thor',
// 'Joe Biden',
// 'Jeffrey Epstein',
// 'Mother Teresa',
// 'Tony Hawk',
// 'An Alligator',
// 'An Elephant',
// 'A Tree',
// 'Rasputin',
// 'Alvin and the Chipmunks',
// 'A Navy Seal',
// 'K-Pop Star',
// 'A wizard',
// 'A german shepard',
// 'The average American',
// 'A Rabbi',
// 'The average Canadian',
// 'McGruff the Crime Dog',
// 'A Buddhist Monk',
// 'Satan',
// 'Jesus Christ',
// 'Robin Hood',
// 'Osama Bin Laden',
// 'Medieval Knight',
// 'Homeless Guy',
// 'The Person to my right',
// 'The Person to my Left',
// 'New York City cop',
// 'Tik Tok Influencer',
// 'Swedish Chef',
// 'Harry Houdini',
// 'A Baby',
// 'Basement Dwelling Nerd',
// 'Andy Warhol',
// 'Leonardo Da Vinci',
// 'Mark Wahlberg',
// 'Waldo',
// 'Elvis Presley',
// 'Winnie The Pooh',
// 'A dragon',
// 'Buzz Lightyear',
// 'Spiderman',
// 'Your Neighbor',
// 'Dr. Jekyll And Mr. Hyde',
// 'Darth Vader',
// 'Borat',
// 'Scooby Doo',
// 'The Mailman',
// 'Will Smith',
// 'Your second grade teacher',
// 'A fry cook',
// 'Infomercial salesman',
// 'A colony of ants',
// 'Street Preacher',
// 'Lawyer',
// 'Hacker',
// 'A blue collar worker',
// 'Winston Churchill',
// 'A Roomba',
// 'Guy Fieri',
// 'Seeing Eye Dog',
// 'Emotional Support Hamster',
// 'My imaginary friend',
// 'Boy Scout',
// 'Carnival Worker',
// 'Matt Damon',
// 'Alex Jones',
// 'Cristiano Ronaldo',
// 'Michael Scott',
// 'Steve Irwin',
// 'Christopher Lee',
// 'Anderson Cooper',
// 'Hunter S. Thompson',
// 'Marie Antoinette',
// 'Vlad the Impaler',
// 'Pamela Anderson',
// 'Guy Fieri',
// 'Voldemort',
// 'Weird Al Yankovic',
// 'King Leonidas',
// 'Babe Ruth',
// 'Tom Brady',
// 'Thomas the Tank Engine',
// 'The headless horseman',
// 'Amazon Alexa',
// 'Two kids in a trenchcoat',
// 'Hugh Hefner',
// 'Theodore Roosevelt',
// 'Rocky Balboa',
// 'Austin Powers',
// 'Bear Grylls',
// 'Jerry Seinfeld',
// 'The Dalai Lama',
// 'A Cowboy',
// 'Harry Houdini',
