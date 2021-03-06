'use strict';

let SubscribeCommand = [
	{
		"Function_Eng": "weather",
		"Function_Kor": "날씨"
	},
	{
		"Function_Eng": "covid19",
		"Function_Kor": "코로나"
	}
];



// API 생성을 위한 모듈 가져오기
const express = require('express');
const app = express();
const PORT = 2697;

var bodyParser = require('body-parser');
const { Connection } = require('tedious');
app.use(bodyParser.urlencoded({extended:true}));
app.use(bodyParser.json());

// mssql 모듈 가져오기
const sql = require('mssql');
// DB 정보 가져오기
const config = require('./Config/dbInfo');

// 현재 날짜, 시간을 가져오기 위한 모듈
var moment = require('moment');
require('moment-timezone');
moment.tz.setDefault("Asia/Seoul");

// 날씨 코드 가져오기 위한 모듈 가져오기
const getWeatherCode = require('./Entity/WeatherCode');

// 명령어 리스트 모듈 가져오기
let returnCommandList = require('./Entity/CommandList');

// 크롤링 관련 모듈 가져오기
const axios = require("axios");
const cheerio = require("cheerio");

// 커스텀 모듈 가져오기
const covid19 = require('./Function/Covid19');
const weather = require('./Function/Weather');
const gameModule = require('./Function/Game');

app.get('/', (req, res) => {
	res.send('둥봇 메인페이지입니다.\n');
	console.log('Running DoongBot');
});

// 일반 채팅
app.post('/chat', (req, res) => {
	console.log("## [POST] 일반 채팅");
	var message = req.body.message;

	const connection = sql.connect(config, (err) => {
		if (err) {
			console.log("[DB 연동 실패]");
			console.log(err);
		} else {
			console.log("[DB 연동 성공]");

			const request = connection.request();
			request.input('message', message)
				   .execute('TestInsert', (err, recordsets, result) => {
						if (err) {
							console.log("[sp 접근 실패]");
							console.log(err);
							res.status(200).json(
								{
									"Test": "error"
								}
							);
						} else {
							console.log("[sp 접근 성공]");
							res.status(200).json(
								{
									"Test": "아직 저는 대화를 못해요\n [/명령어]로 사용가능한 명령어 검색 후 저를 이용해주세요!! (찡긋)"
									// "Test": message
								}
							);
						}
				   })
		}
	});
});

app.get('/test', (req, res) => {
	const connection = sql.connect(config,(err) => {
		if (err) {
			console.log(err)
		} else {
			console.log("DB 연동 성공");

			const request = connection.request();
			request.query('SELECT * FROM TestTable', (err, result) => {
				if (err) {
					res.status(200).json(
						{
							"Test": "error"
						}
					);
				} else {
					res.status(200).json(result.recordsets[0]);
				}
			})
		}
	});
});

app.post('/test2', (req, res) => {
	console.log("## [POST] test2");
	var message2 = req.body.message;
	console.log("Message : " + message2);
	
	console.log("DB 연동 시작");

	const connection = sql.connect(config,(err) => {
		if (err) {
			console.log(err)
		} else {
			console.log("DB 연동 성공");

			const request = connection.request();
			request.input('Test', sql.NVarChar, message2);
			request.query('INSERT INTO TestTable (Test) values (@Test)', (err, result) => {
				if (err) {
					res.status(200).json(
						{
							"message": "error"
						}
					);
				} else {
					console.log("DB INSERT 성공");
					console.log(result);

					res.status(200).json(
						{
							"message": "success"
						}
					);
				}
				
			})

		}
	});
});

// 날씨 API 테스트
app.get('/weather', (req, res) => {
	// 파라미터 값 가져오기
	var City = req.query.city;
	var Gu = req.query.gu;

	const connection = sql.connect(config, (err) => {
		if (err) {
			console.log("[DB 연동 실패] - 좌표불러오기");
			console.log(err);
		} else {
			console.log("[DB 연동 성공] - 좌표불러오기");

			const request = connection.request();
			request.input('City', sql.NVarChar(50), City)
				   .input('Gu', sql.NVarChar(50), Gu)
				   .execute('GetCityCoordinate', (err, recordsets, returnValue) => {
						if (err) {
							console.log("[sp 접근 실패] - 좌표불러오기");
							console.log(err);
							res.status(200).json(
								{
									"Message": "error"
								}
							);
						} else {
							console.log("[sp 접근 성공] - 좌표불러오기");
							if (Object.keys(recordsets.recordset).length == 0) {
								res.status(200).json(
									{
										"Message": "\n정확하지 않은 지역정보입니다.\n다시 확인하셔서\n[/날씨 서울특별시 노원구]와 같이 입력해주세요."
									}
								)
							} else {
								var Coordinate_X = '';
								var Coordinate_Y = '';
	
								Coordinate_X = recordsets.recordset[0].Coordinate_X;
								Coordinate_Y = recordsets.recordset[0].Coordinate_Y;
	
								console.log(City + " " + Gu + " 날씨 API 호출");
	
								var request = require('request');
	
								var url = 'http://apis.data.go.kr/1360000/VilageFcstInfoService/getVilageFcst';
	
								var queryParams = '?' + encodeURIComponent('ServiceKey') + '=wt3L6lWDNYu7bbcnV0%2F3eNqzwSygZF2X%2B9%2FU4yPWUOi5dayeP7ePFqhlp245rAwvWgpyar3keBs7mH%2Fkb9Up9Q%3D%3D';
								queryParams += '&' + encodeURIComponent('pageNo') + '=' + encodeURIComponent('1');
								queryParams += '&' + encodeURIComponent('numOfRows') + '=' + encodeURIComponent('80');
								queryParams += '&' + encodeURIComponent('dataType') + '=' + encodeURIComponent('JSON');
								queryParams += '&' + encodeURIComponent('base_date') + '='+ encodeURIComponent(moment().format('YYYYMMDD'));
								queryParams += '&' + encodeURIComponent('base_time') + '=' + encodeURIComponent(getWeatherCode('WeatherTime', moment().format('HHmm')));
								queryParams += '&' + encodeURIComponent('nx') + '=' + encodeURIComponent(Coordinate_X);
								queryParams += '&' + encodeURIComponent('ny') + '=' + encodeURIComponent(Coordinate_Y);
	
								request({
									url: url + queryParams,
									method: 'GET'
								}, function (error, response, body) {
									console.log("날씨 API 호출 성공");
	
									var weatherResult = {
										"POP": "", // 강수확률 (%)
										"PTY": "", // 강수형태 (코드)
										"REH": "", // 습도 (%)
										"SKY": "", // 하늘상태 (코드)
										"T3H": "", // 현재기온 (도)
										"TMN": "", // 아침 최저기온 (도)
										"TMX": "" // 낮 최고온도 (도)
									};
	
									var weatherData = JSON.parse(response.body).response.body.items.item;
	
									for (var idx in weatherData) {
										switch(weatherData[idx].category) {
											case 'POP':
												weatherResult.POP = weatherData[idx].fcstValue;
												break;
											case 'PTY':
												weatherResult.PTY = weatherData[idx].fcstValue;
												break;
											case 'REH':
												weatherResult.REH = weatherData[idx].fcstValue;
												break;
											case 'SKY':
												weatherResult.SKY = weatherData[idx].fcstValue;
												break;
											case 'T3H':
												weatherResult.T3H = weatherData[idx].fcstValue;
												break;
											case 'TMN':
												weatherResult.TMN = weatherData[idx].fcstValue;
												break;
											case 'TMX':
												weatherResult.TMX = weatherData[idx].fcstValue;
												break;
											default:
												break;
										}
									}
	
									console.log(weatherResult);
	
									var message = '\n';
									message += City + ' ' + Gu + ' 의 날씨 정보입니다.\n';
									message += '현재 온도 : ' + weatherResult.T3H + '℃\n';
									message += '(' + getWeatherCode('SkyType', weatherResult.SKY) + ')\n';
									message += '최저 온도 : ' + weatherResult.TMN + '℃\n';
									message += '최고 온도 : ' + weatherResult.TMX + '℃\n';
									message += '강수확률은 ' + weatherResult.POP + '% 입니다.';
	
									var result = {
										"Message": message
									}
	
									res.status(200).json(result);
								});
							}
						}
				   })
		}
	});
});

//#region # 구독 관련 주소

// 구독 기능 리스트 가져오기
app.post('/subscribe/subscribeList', (req, res) => {
	res.status(200).json(
			SubscribeCommand
	);
})

// 구독자 리스트 가져오기
app.post('/subscribe/list', (req, res) => {

	SubscribeSelect().then(function(resultMessage) {
		// console.log(resultMessage);

		let weatherList = "";
		let covid19List = "";

		for (var idx in resultMessage) {
			if (resultMessage[idx].Weather.trim() == "Y") {
				weatherList += resultMessage[idx].NickName;
				weatherList += ",";
			}

			if (resultMessage[idx].Covid19.trim() == "Y") {
				covid19List += resultMessage[idx].NickName;
				covid19List += ",";
			}
		}

		// console.log(weatherList);
		// console.log(covid19List);

		if (weatherList.length != 0) {
			weatherList = weatherList.substring(0, weatherList.length - 1);
		}

		if (covid19List.length != 0) {
			covid19List = covid19List.substring(0, covid19List.length - 1);
		}

		// 배열에 덮어쓰기 하지 않으려면 result 계속 초기화시켜줘야함
		let resultArray = new Array();

		let result = new Object();

		result.Function = "weather";
		result.UserList = weatherList;
		resultArray.push(result);

		console.log(resultArray);

		result = new Object();

		result.Function = "covid19";
		result.UserList = covid19List;
		resultArray.push(result);

		console.log(resultArray);

		res.status(200).json(
			resultArray
		);
	});

});

// [구독] 날씨
app.post('/subscribe/weather', (req, res) => {
	res.status(200).json(
		{
			"Message": "날씨 구독기능은 개발중이에요 (찡긋)"
		}
	);
});

// [구독] 코로나
app.post('/subscribe/covid19', (req, res) => {

	var from = req.body.From;
	console.log(from + "의 코로나 구독기능 요청")

	covid19.GetCovid19Info().then(function(resultMessage) {
		res.status(200).json(
			{
				"Message": resultMessage
			}
		)
	});

});

//#endregion

//#region # 게임 관련 주소

app.post('/numberBaseball', (req, res) => {
	let NickName = req.body.NickName;
	let RoomName = req.body.RoomName;

	gameModule.GetNumberBaseballGameRanking(NickName, RoomName).then(function(resultMessage) {
		res.status(200).json(
			{
				"Message": resultMessage
			}
		);
	})
})

//#endregion

//#region # 일반 명령어

app.get('/getRequest', (req, res) => {
	// 명령어 가져오기
	let command = req.query.command
	let from = req.query.from
	let room = req.query.room
	
	let param1 = req.query.param1
	let param2 = req.query.param2
	let param3 = req.query.param3

	
	// 명령어 검색 사용
	if (command == "명령어") {
		console.log("사용 가능 명령어 정보 요청");
		console.log("방이름 : " + room);
		res.status(200).json(
			{
				"Message": returnCommandList(room)
			}
		);
	} 

	//#region ## 날씨 관련 분기처리

	//#region ### 날씨 명령어 사용
 	else if (command == "날씨") {
		weather.GetWeather(from, param1, param2, param3).then(function(resultMessage) {
			res.status(200).json(
				{
					"Message": resultMessage
				}
			);
		});
	}
	//#endregion

	//#endregion

	//#region ## 코로나 관련 분기처리 
	//#region ### 확진자 현황 검색
	else if (command == "코로나") {
		covid19.GetCovid19Info().then(function(resultMessage) {
			res.status(200).json(
				{
					"Message": resultMessage
				}
			);
		});
	}
	//#endregion

	//#endregion

	//#region ## 구독 관련 분기처리

	//#region ### 구독 관련 명령어 처리
	
	else if (command == "구독") {
		let subscribeMessage = "[둥봇 안내메세지]\n";

		// 구독 기능 추가
		if (param1 == "기능") {
			if (param3 == "room") {
				subscribeMessage += "단톡방에서는 관리자만 구독할 수 있어요.\n";
				subscribeMessage += "우리 좀 더 친해지면\n";
				subscribeMessage += "카톡친추해요~(뽀뽀)(뽀뽀)(뽀뽀)";

				res.status(200).json(
					{
						"Message": subscribeMessage
					}
				);
			}
			else {
				if (param2 == "날씨") {
					SubscribeUpsert(from, from, 'Y', 'S').then(function(resultMessage) {
						if (resultMessage == "Error") {
							subscribeMessage += "날씨 알림 기능 추가 실패";
						} else if (resultMessage == "Success") {
							subscribeMessage += "날씨 알림 기능 추가 완료";
						}
	
						res.status(200).json(
							{
								"Message": subscribeMessage
							}
						);
					});
				}
				else if (param2 == "코로나") {
					SubscribeUpsert(from, from, 'S', 'Y').then(function(resultMessage) {
						if (resultMessage == "Error") {
							subscribeMessage += "코로나 알림 기능 추가 실패";
						} else if (resultMessage == "Success") {
							subscribeMessage += "코로나 알림 기능 추가 완료";
						}
	
						res.status(200).json(
							{
								"Message": subscribeMessage
							}
						);
					});
				}
				else if (param2 == "?") {
					var result = '[구독 가능한 기능 리스트]\n';
	
					for (var idx in SubscribeCommand) {
						result += ((Number(idx) + 1) + '. ' + SubscribeCommand[idx].Function_Kor + '\n');
					}
	
					res.status(200).json(
						{
							"Message": result
						}
					);
				}
				else {
					var result = '[구독 가능한 기능 리스트]\n';
	
					for (var idx in SubscribeCommand) {
						result += ((Number(idx) + 1) + '. ' + SubscribeCommand[idx].Function_Kor + '\n');
					}
	
					res.status(200).json(
						{
							"Message": result
						}
					);
				}
			}
		}

		// 구독 기능 취소
		else if (param1 == "기능취소")  {
			if (param3 == "room") {
				subscribeMessage += "단톡방에서는 관리자만 구독할 수 있어요.\n";
				subscribeMessage += "우리 좀 더 친해지면\n";
				subscribeMessage += "카톡친추해요~(뽀뽀)(뽀뽀)(뽀뽀)";

				res.status(200).json(
					{
						"Message": subscribeMessage
					}
				);
			}
			else {
				if (param2 == "날씨") {
					SubscribeUpsert(from, from, 'N', 'S').then(function(resultMessage) {
						if (resultMessage == "Error") {
							subscribeMessage += "날씨 알림 기능 취소 실패";
						} else if (resultMessage == "Success") {
							subscribeMessage += "날씨 알림 기능 취소 완료";
						}
	
						res.status(200).json(
							{
								"Message": subscribeMessage
							}
						);
					});
				}
				else if (param2 == "코로나") {
					SubscribeUpsert(from, from, 'S', 'N').then(function(resultMessage) {
						if (resultMessage == "Error") {
							subscribeMessage += "코로나 알림 기능 취소 실패";
						} else if (resultMessage == "Success") {
							subscribeMessage += "코로나 알림 기능 취소 완료";
						}
	
						res.status(200).json(
							{
								"Message": subscribeMessage
							}
						);
					});
				}
				else {
					var result = '[구독 가능한 기능 리스트]\n';
	
					for (var idx in SubscribeCommand) {
						result += ((Number(idx) + 1) + '. ' + SubscribeCommand[idx].Function_Kor + '\n');
					}
	
					res.status(200).json(
						{
							"Message": result
						}
					);
				}
			}
		}

		// 구독 관련 명령어 출력
		else if (param1 == "?") {
			// 코드 입력
		}

		// 관리자 구독
		else if (param1 == "admin") {
			if (param3 == "admin") {
				subscribeMessage += "관리자 구독 실행 완료!!";
			}
			else if (param3 == "notadmin") {
				subscribeMessage += "관리자가 아닙니다.\n";
				subscribeMessage += "관리자 구독 실패!!";
			}

			res.status(200).json(
				{
					"Message": subscribeMessage
				}
			);
		}

		// 단톡방에서 구독
		else if (param1 == "단톡") {
			if (param3 == "admin") {
				subscribeMessage += room + "\n";
				subscribeMessage += "구독 완료!!";
			}
			else if (param3 == "notroom") {
				subscribeMessage += "개인에게는 이 기능은 사용할 수 없어요\n";
				subscribeMessage += "[/구독] 이 명령어를 이용해보세요(뽀뽀)";
			}
			else if (param3 == "notadmin") {
				subscribeMessage += "단톡방을 구독시키는건 주인님밖에 못해요!!";
			}

			res.status(200).json(
				{
					"Message": subscribeMessage
				}
			);
		}

		else if (param1 == ""){
			// ADMIN 구독
			if (param3 == "admin") {
				subscribeMessage += "ADMIN 구독 완료";

				res.status(200).json(
					{
						"Message": subscribeMessage
					}
				);
			}
			// 일반 구독
			else if (param3 == "normal") {
				SubscribeUpsert(from, from, '', '').then(function(resultMessage) {
					if (resultMessage == "Error") {
						subscribeMessage += "구독 실패";
					} else if (resultMessage == "Success") {
						subscribeMessage += "구독 완료\n";
						subscribeMessage += from + "님 반가워요~";
					}

					res.status(200).json(
						{
							"Message": subscribeMessage
						}
					);
				});
			}
			// 닉네임 이미 존재
			else if (param3 == "using") {
				subscribeMessage += "이미 존재하는 닉네임입니다.\n";
				subscribeMessage += "< /구독 닉네임 [닉네임입력] > \n";
				subscribeMessage += "다음 명령어를 이용하여 다시 구독해주세요.";
				subscribeMessage += "\n\n 사실 다음 명령어 아직 안만들었어요 기다려주세요.(찡긋)(찡긋)(찡긋)";

				res.status(200).json(
					{
						"Message": subscribeMessage
					}
				);
			}
			// 단톡방에서 구독누른 경우
			else if (param3 == "room") {
				subscribeMessage += "단톡방에서는 관리자만 구독할 수 있어요.\n";
				subscribeMessage += "우리 좀 더 친해지면\n";
				subscribeMessage += "카톡친추해요~(뽀뽀)(뽀뽀)(뽀뽀)";

				res.status(200).json(
					{
						"Message": subscribeMessage
					}
				);
			}
		}
		else {
			// 구독관련 명령어 출력
		}
	}

	//#endregion
	
	//#region ### 구독 취소 관련 명령어 처리

	else if (command == "구독취소") {
		let cancelSubscribeMessage = "[둥봇 안내메세지]\n";

		// 앱 내에 취소할 아이디가 있는 경우
		if (param3 == "exist") {
			SubscribeDelete(from).then(function(resultMessage) {
				cancelSubscribeMessage += resultMessage;

				res.status(200).json(
					{
						"Message": cancelSubscribeMessage
					}
				);	
			});
		}
		// 앱 내에 취소할 아이디가 있지만 닉네임과 일치하지 않은 경우
		else if (param3 == "notcorrespond") {
			cancelSubscribeMessage += "본인이 아닌거같은데요\n";
			cancelSubscribeMessage += "(열받아)(열받아)(열받아)(열받아)";

			res.status(200).json(
				{
					"Message": cancelSubscribeMessage
				}
			);
		}
		// 앱 내에 취소할 아이디가 없는 경우
		else if (param3 == "none") {
			cancelSubscribeMessage += "구독취소할 닉네임이 없네요\n";
			cancelSubscribeMessage += "(깜짝)(깜짝)(깜짝)(깜짝)(깜짝)";

			res.status(200).json(
				{
					"Message": cancelSubscribeMessage
				}
			);
		}
		else if (param3 == "admin") {
			SubscribeDelete(param1).then(function(resultMessage) {
				cancelSubscribeMessage += "Admin 권한으로 삭제요청\n";
				cancelSubscribeMessage += resultMessage;

				res.status(200).json(
					{
						"Message": cancelSubscribeMessage
					}
				);	
			});
		}
	}

	//#endregion

	//#region ### 구독자 확인 관련 명령어 처리

	else if (command == "구독확인") {
		let confirmSubscribe = "[구독자 리스트]\n";

		confirmSubscribe += param3;

		res.status(200).json(
			{
				"Message": confirmSubscribe
			}
		);
	}

	//#endregion

	//#region ## 깃 허브 커밋 단톡방 관련 명령어

	//#region ### /인증 기능
	else if (command == "인증") {
		if (room.indexOf('잔디') != -1) {
			CompareCommitStatus(from).then(function(resultMessage) {
				res.status(200).json(
					{
						"Message": resultMessage
					}
				);
			})
		} else {
			res.status(200).json(
				{
					"Message": "해당 방에서는 사용할 수 없는 기능입니다."
				}
			);
		}
	}
	//#endregion

	//#region ### 인증확인
	else if (command == "인증확인") {
		console.log('param1 : ' + param1 + '\nparam2 : ' + param2 + '\n');
		if (room.indexOf('잔디') != -1 || from == '조창우') {
			if (param1 == '' && param2 == '') {
				GitCommitLogSelect('', '').then(function(resultMessage) {
					res.status(200).json(
						{
							"Message": '[당일 인증 리스트]\n' + resultMessage
						}
					);
				})
			} else if (param1 != '' && param2 != '') {
				GitCommitLogSelect(param1, param2).then(function(resultMessage) {
					res.status(200).json(
						{
							"Message": resultMessage
						}
					);
				})
			} else {
				res.status(200).json(
					{
						"Message": "[리스트 불러오기 실패]\n입력한 날짜 양식을 확인해주세요(흥)"
					}
				)
			}
		} else {
			res.status(200).json(
				{
					"Message": "해당 방에서는 사용할 수 없는 기능입니다."
				}
			);
		}
		
	}
	//#endregion

	//#region ### 인증이벤트 시작시간 끝시간 최소횟수

	else if (command == "인증이벤트") {
		console.log('StartDate : ' + param1 + '\nEndDate : ' + param2 + '\nLeastCount : ' + param3);
		if (room.indexOf('잔디') != -1 || from == '조창우') {
			GitCommitEvent(param1, param2, param3).then(function(resultMesage) {
				res.status(200).json(
					{
						"Message": resultMesage
					}
				);
			})
		} else {
			res.status(200).json (
				{
					"Message": "해당 방에서는 사용할 수 없는 기능입니다."
				}
			);
		}
	}

	//#endregion

	//#endregion

	//#region ## 게임 관련 명령어 처리

	else if (command == "?") {
		if (param1 = "숫자야구") {
			res.status(200).json(
				{
					"Message": gameModule.HowToPlay("NumberBaseball")
				}
			);
		}
	}

	//#endregion

	//#region ### 특별 명령어

	// 구독자 정보 관련 명령어
	else if (command == "REQUEST_SUBSCRIBE_LIST") {
		SubscribeSelect().then(function(resultMessage) {
			// console.log(resultMessage);

			let weatherList = "";
			let covid19List = "";

			for (var idx in resultMessage) {
				if (resultMessage[idx].Weather.trim() == "Y") {
					weatherList += resultMessage[idx].NickName;
					weatherList += ",";
				}

				if (resultMessage[idx].Covid19.trim() == "Y") {
					covid19List += resultMessage[idx].NickName;
					covid19List += ",";
				}
			}

			// console.log(weatherList);
			// console.log(covid19List);

			if (weatherList.length != 0) {
				weatherList = weatherList.substring(0, weatherList.length - 1);
			}

			if (covid19List.length != 0) {
				covid19List = covid19List.substring(0, covid19List.length - 1);
			}

			let result = weatherList + "\\" + covid19List;

			res.status(200).json(
				{
					"Message": result
				}
			);
		});
	}

	// 임포스터 (이벤트)
	else if (command == "임포스터") {
		let impostor = ". 　。　　　　•　 　ﾟ　　。 .\n"
		+ "　　.　　　.　　　 　　.　　　　　。　　 。　.\n"
		+ "　.　　 . 。　 ඞ 。　 . •\n"
		+ "• . " + param1 + "님은(는) 임포스터였습니다.　。.\n"
		+ "　 　　。　　　　　　ﾟ　　　.　　　　　.\n"　　
		+ ",　　　　.　 .　　 . . .";

		res.status(200).json(
			{
				"Message": impostor
			}
		);
	}

	//#endregion

	//#endregion

	// else if (command == "테스트") {
	// 	console.log("테스트중")

	// 	res.status(200).json(
	// 		{
	// 			"Message": "구독자에게 메세지 보내기 테스트"
	// 		}
	// 	);
	// }

	//#region ## 기타기능

	else if (command == "로또추첨") {
		let lottoMessage = "[둥봇의 로또추첨]\n";
		lottoMessage += param1 + "\n";
		lottoMessage += "당첨되면 5% 떼줘요(뽀뽀)";

		res.status(200).json(
			{
				"Message": lottoMessage
			}
		);
	}

	else if (command == "우리만난지") {
		let anniversaryMessage = "[둥봇의 기념일계산]\n";
		anniversaryMessage += "(축하)***********************\n";
		anniversaryMessage += "우리가 만난지 " + param1 + "일째에요\n";
		anniversaryMessage += "************************(하트)";

		res.status(200).json(
			{
				"Message": anniversaryMessage
			}
		);
	}

	else if (command == "시간테스트") {
		process.env.TZ = 'Asia/Seoul';
		res.status(200).json(
			{
				"Message": new Date()
			}
		)
	}

	//#endregion

	// 예시!!!
	// CommandCheck(command).then(function(commandResult) {
	// 	console.log("CommandResult22 : " + commandResult);
	// 	if (commandResult == "success") {
	// 		res.status(200).json(
	// 			{
	// 				"Message": "명령어 체크 성공"
	// 			}
	// 		);
	// 	} else {
	// 		res.status(200).json(
	// 			{
	// 				"Message": "명령어 체크 실패"
	// 			}
	// 		);
	// 	}1
	// });
})

//#endregion

//#region # 구독 기능

// 구독자 정보 DB에 데이터 확인
function SubscribeSelectItem(nickName) {

}

// 구독자 정보 DB에 데이터 삭제하는 함수
function SubscribeDelete(nickName) {
	return new Promise(function(resolve, reject) {
		const connection = sql.connect(config, (err) => {
			if (err) {
				console.log("[구독자 DB 연동 실패]");
				console.log(err);
			} else {
				console.log("[구독자 DB 연동 성공]");

				const request = connection.request();
				request.input('NickName', sql.NVarChar(100), nickName)
					   .execute('SubscribeDelete', (err, recordsets, returnValue) => {
							if (err) {
								console.log("[구독자 삭제 SP 접근 실패]");
								console.log(err);

								resolve("구독취소 실패");
							} else {
								console.log("[구독자 삭제 SP 접근 성공]");

								resolve("구독취소 성공");
							}
					   });
			}
		});
	});
}

// 구독자 정보 DB에 저장 및 변경하는 함수
function SubscribeUpsert(nickName, from, weather, covid19) {
	return new Promise(function(resolve, reject) {
		const connection = sql.connect(config, (err) => {
			if (err) {
				console.log("[구독자 DB 연동 실패]");
				console.log(err);
			} else {
				console.log("[구독자 DB 연동 성공]");

				const request = connection.request();
				request.input('NickName', sql.NVarChar(100), nickName)
					   .input('UserName', sql.NVarChar(100), from)
					   .input('Weather', sql.Char(2), weather)
					   .input('Covid19', sql.Char(2), covid19)
					   .execute('SubscribeUpsert', (err, recordsets, returnValue) => {
							if (err) {
								console.log("[구독자 SP 접근 실패]");
								console.log(err);
								
								resolve("Error");
							} else {
								console.log("[구독자 SP 접근 성공]");

								// 신규 등록
								if (Object.keys(recordsets.recordsets).length == 0) {
									console.log("신규등록");
								}
								// 재등록 (정보 알려줘야함)
								else {
									console.log("재등록");
								}

								resolve("Success");
							}
					   });
			}
		});
	});
}

function SubscribeSelect() {
	return new Promise(function(resolve, reject) {
		const connection = sql.connect(config,(err) => {
			if (err) {
				console.log("[구독자 DB 연동 실패]");
				console.log(err)
			} else {
				console.log("[구독자 DB 연동 성공]");
	
				const request = connection.request();
				request.execute('SubscribeSelect', (err, recordsets, returnValue) => {
					if (err) {
						console.log("[구독자 SP 접근 실패]");
						console.log(err);
					} else {
						console.log("[구독자 SP 접근 성공]");

						resolve(recordsets.recordset);
					}
				});
			}
		});
	});
}

//#endregion

//#region # 깃 허브 커밋 단톡방 관련 메서드 (잔디)

//#region ## 인증 확인 메서드
function CompareCommitStatus(UserName) {

    return new Promise(function(resolve, reject) {
        const connection = sql.connect(config, (err) => {
            if (err) {
                console.log("[DB 연동 실패]");
                console.log(err);
            } else {
                console.log("[DB 연동 성공]");

                const request = connection.request();
                request.input('UserName', sql.NVarChar(50), UserName)
                       .execute('GitCommitRoomSelectURL', (err, recordsets, returnValue) => {
                           if (err) {
                               console.log("[sp 접근 실패]");
                               console.log(err);
                           } else {
                               console.log("[sp 접근 성공]");

                               if (recordsets.recordset.length == 0) {
                                   console.log(recordsets)
                                   resolve("[인증 실패]\n" + UserName + "님의 아이디에 대한 Github Profile URL이 존재하지 않습니다.");
                                   return;
                               }

                               let GitURL = recordsets.recordset[0].GitURL;
							   let GitNickName = GitURL.split('/')[3];
							   //?to=' + moment().format('YYYY-MM-DD')
                               let CommitURL = 'https://github.com/users/' + GitNickName + '/contributions';

                               const getGitHtml = async () => {
                                    try {
                                        return await axios.get(CommitURL);
                                    } catch (error) {
										console.error(error);
										let errorMessage = "";
										errorMessage += "[인증 실패]\n";
										errorMessage += "해당 날짜에는 Github에서 커밋 정보를 주질않아서 인증이 불가능해요...(훌쩍)(훌쩍)";
										resolve(errorMessage);
                                    }
                                };
                        
                                getGitHtml().then(html => {
                                    const $ = cheerio.load(html.data);
                                    const $bodyList = $("div.border.py-2.graph-before-activity-overview g").children("rect");
                        
                                    let list = {};
                        
                                    let today = moment().format('YYYY-MM-DD');
                                    
                                    $bodyList.each(function(i, elem) {
                                        if (today == $(this).attr('data-date')) {
                                            list = {
                                                date: $(this).attr('data-date'),
                                                count: $(this).attr('data-count')
                                            };
                                        }
                                    });
                        
                                    console.log(list);

                                    let Message = "";
                                    if (list.count > 0) {
                                        const logRequest = connection.request();
                                        logRequest.input('UserName', sql.NVarChar(50), UserName)
                                                  .execute('GitCommitLogInsert', (err, recordsets, returnValue) => {
                                                      if (err) {
                                                          console.log("[Git Log Insert 실패]");
                                                          console.log(err);
                                                      } else {
                                                          console.log("[Git Log Insert 성공]");

                                                          let logInsertResult = recordsets.recordset[0].Result;

                                                          if (logInsertResult == "exist") {
															  Message = "[인증 실패]\n";
															  Message += UserName + "님 이미 인증했어요.(씨익)(씨익)"
                                                              resolve(Message);
                                                          } else if (logInsertResult == "success") {
                                                              Message = "[인증 성공]\n";
															  Message += UserName + "님 오늘 하루도 수고하셨어요.(뽀뽀)(뽀뽀)\n";
															  Message += '사진 인증도 해야하는거 아시죠??';
                                                              resolve(Message);
                                                          }
                                                      }
                                                  })
                                    } else {
                                        Message = "[인증 실패]\n";
                                        Message += UserName + "님 단톡방에 등록한 GitHub Profile URL 및 Push가 제대로 되었는지 확인해주세요.";
                                        resolve(Message);
                                    }
                                });
                            }
                       })
            }
        })
    })
}
//#endregion

//#region ## 인증 리스트 SELECT 메서드

function GitCommitLogSelect(StartDate, EndDate) {

    return new Promise(function(resolve, reject) {
        const connection = sql.connect(config, (err) => {
            if (err) {
                console.log("[DB 연동 실패]");
                console.log(err);
            } else {
                console.log("[DB 연동 성공]");

                const request = connection.request();
                request.input('StartDate', sql.NVarChar(50), StartDate)
                       .input('EndDate', sql.NVarChar(50), EndDate)
                       .execute('GitCommitLogSelect', (err, recordsets, returnValue) => {
                           if (err) {
                               console.log('[sp 접근 실패]');
                               console.log(err);
                           } else {
                               console.log("[sp 접근 성공]");

                               if (recordsets.recordset.length == 0) {
                                   console.log(recordsets);
                                   resolve("[검색 실패]\n해당 기간에는 인증 데이터가 없어요");
                                   return;
                               }

							   let resultMessage = '';
							   let dateCriteria = '';

                               for (var idx in recordsets.recordset) {
								   if (dateCriteria != recordsets.recordset[idx].CertifiedDate) {
									   dateCriteria = recordsets.recordset[idx].CertifiedDate;
									   
									   resultMessage += '[' + recordsets.recordset[idx].CertifiedDate + ' 리스트]\n';
									   resultMessage += '닉네임 : ' + recordsets.recordset[idx].UserName + '\n';
                                   	   resultMessage += '인증시간 : ' + recordsets.recordset[idx].CertifiedDate + '\n\n';
								   	} else {
										resultMessage += '닉네임 : ' + recordsets.recordset[idx].UserName + '\n';
                                   		resultMessage += '인증시간 : ' + recordsets.recordset[idx].CertifiedDate + '\n\n';
									}
                               }

                               console.log(recordsets.recordset);

                               resolve(resultMessage)
                           }
                       });
            }
        });
    });

}

//#endregion

//#region ## 인증 이벤트 메서드

function GitCommitEvent(StartDate, EndDate, LeastCount) {
	return new Promise(function(resolve, reject) {
		const connection = sql.connect(config, (err) => {
			if (err) {
				console.log("[DB 연동 실패]");
				console.log(err);
			} else {
				console.log("[DB 연동 성공]");

				const request = connection.request();
				request.input('StartDate', sql.NVarChar(50), StartDate)
					   .input('EndDate', sql.NVarChar(50), EndDate)
					   .input('LeastCount', sql.Int, LeastCount)
					   .execute('GitCommitEvent', (err, recordsets, returnValue) => {
						   if (err) {
							   console.log("[SP 접근 실패]");
							   console.log(err);
						   } else {
							   console.log("[SP 접근 성공]");

							   if (recordsets.recordset.length == 0) {
								   resolve("[조회 실패]\n데이터가 잘못된거같아요 ㅠㅠ 금방 고칠게요");
								   return;
							   }

							   let resultMessage = '';

							   let count = 0;
							   for (var idx in recordsets.recordset) {
								   resultMessage += '[닉네임]\n';
								   resultMessage += recordsets.recordset[idx].UserName + '\n';
								   resultMessage += '인증횟수    상태\n';
								   resultMessage += '     ' + recordsets.recordset[idx].LogCount + '         ' + recordsets.recordset[idx].Status + '\n';
								   resultMessage += '---------------------------\n';
								   count++;
							   }

							   let lastMessage = '[이벤트 결과] (총원 ' + count + '명)\n';
							   lastMessage += '---------------------------\n';
							   lastMessage += resultMessage;

							   resolve(lastMessage);
						   }
					   })
			}
		})
	})
}

//#endregion

//#endregion

//#region # 특별기능



//#endregion

// 명령어 존재유무 체크함수
function CommandCheck(command) {
	let commandResult = "";
	console.log("명령어 : " + command);

	return new Promise(function(resolve, reject) {
		const connection = sql.connect(config, (err) => {
			if (err) {
				console.log("[DB 연동 실패] - 명령어 검색");
				console.log(err);
				resolve(commandResult);
			} else {
				const request = connection.request();
				request.input('Command', sql.NVarChar(30), command)
					   .execute('CommandCheck', (err, recordsets, returnValue) => {
							if (err) {
								console.log("[sp 접근 실패] - 명령어 검색");
								console.log(err);
								resolve(commandResult);
							} else {
								var result = recordsets.recordset[0].Result;
	
								if (result == "0") {
									console.log("[sp 접근 성공] - 명령어 없음");
									console.log("결과값 : " + result);
									resolve(commandResult);
								} else {
									console.log("[sp 접근 성공] - 명령어 있음");
									console.log("결과값 : " + result);
									commandResult = "success";
									resolve(commandResult);
								}
							}
					   })
			}
			// console.log("CommandResult : " + commandResult);
		});
	});
}

app.listen(PORT, () =>
	console.log('Running on http://localhost:' + PORT.toString())
)