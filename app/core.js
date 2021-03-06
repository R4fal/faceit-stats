/* globals angular */

/** TODO
* More data
*/

(function() {
	var app = angular.module("app", []);

	app.factory("scrap", ["$http", "$q", function($http, $q) {
		var service = {
			matches_api_url: "https://api.faceit.com/stats/api/v1/stats/time/users/",
			nickname_api_url: "https://api.faceit.com/api/nicknames/",
			current_user: null,
			min_matches: 3,
			progress: 0,
			_findFaction: function(json) {
			  var faction = "faction";
			  for (var ii = 0; ii < json[faction + "1"].length; ii++) {
				if (json[faction + "1"][ii].nickname == this.current_user) {
				  faction += "1";
				  break;
				}
			  }
			  if (faction.substr(-1, faction.length) === "n")
				faction += "2";
			  return faction;
			},
			_fillData: function (datas, json, faction, winner) {
			  for (var y=0;y<json[faction].length;y++) {
				var user = json[faction][y].nickname;
				if (user !== this.current_user) {
				  if (user in datas) {
				  	var totalGames = Number(datas[user].wins) + Number(datas[user].losses);
					if (winner === faction) {
					  datas[user].wins++;
					  datas[user].percentage = Math.floor((datas[user].wins / (totalGames + 1)) * 100);
					} else {
					  datas[user].losses++;
					  datas[user].percentage = Math.floor((datas[user].wins / (totalGames + 1)) * 100);
					}
				  }
				  else {
					datas[user] = {"wins": (winner === faction ? 1 : 0), "losses": (winner !== faction ? 1 : 0)};
				  }
				}
			  }
			  return datas;
			},
			getData: function (matches) {
				var self = this;
				var map = {};
				return (new Promise(function (resolve, reject) {
					var progress = 0;
					var wait = [];
					var loopMatches = function(i) {
						return $http.get("https://api.faceit.com/api/matches/" + matches[i].matchId + "?withStats=true").then(function (response) {
							console.log("getting stats on match : " + matches[i].matchId, service.progress);
							var json = response.data.payload;
							var winner = json.winner;
							var faction = service._findFaction(json);
							service.progress = (((progress * 40) / matches.length) + 60);
							progress++;
							return (service._fillData(map, json, faction, winner));
						});
					};
					for (var i in matches) {
						wait.push(loopMatches(i));
					}
					service.progress = 60;
					return Promise.all(wait).then(function () {
						var datas = [];
						for (var i in map) {
							datas.push({
								username: i,
								data: map[i]
							});
						}
						resolve(datas);
					}, function (error) {
						reject(error);
					});
				}));
			},
			getUserHash: function() {
				var self = this;
				console.log("nickname : ", self.current_user);
				console.log("calling " + self.nickname_api_url + self.current_user + " ...");
				return (new Promise(function(resolve, reject) {
					$http.get(self.nickname_api_url + self.current_user).then(function(response) {
						console.log("user guid : ", response.data.payload.guid);
						resolve(response.data.payload.guid);
					}, function(error) {
						// 404 user not found
						reject(error);
					});
				}));
			},
			getUserMatches: function (user_hash) {
				var self = this;
				console.log(self.matches_api_url + user_hash + "/games/csgo?page=0&size=100000");
				service.progress = 10;
				return $http.get(self.matches_api_url + user_hash + "/games/csgo?page=0&size=100000").then(function (response) {
					console.log("response : ", response);
					service.progress = 50;
					return response.data;
				});
			},
			fetch: function(nickname) {
				var user_hash = "";
				this.current_user = nickname;
				return (new Promise(function(resolve, reject) {
					service.getUserHash().then(function (user_hash) {
						service.getUserMatches(user_hash).then(function (matches) {
							service.getData(matches).then(function (datas) {
								resolve(datas);
							}, function (error) {
								reject("error while getting data : ", error);
							});
						}, function (error) {
							reject("error while getting matches : ", error);
						});
					}, function (error) {
						reject("error while getting user's hash : ", error);
					});
				}));
			}
		};
		return service;
	}]);

	app.filter('range', function() {
	    return function (items, property, min) {
	    	return items.filter(function(item){
	    		var matches = (item[property].wins + item[property].losses);
		        return matches >= min;  
		    });
	    }
  	});

	app.controller("controller", ["$scope", "$timeout", "$filter", "scrap", function ($scope, $timeout, $filter, scrap) {
		$scope.service = scrap;
		$scope.data = [];
		$scope.user = {};
		$scope.filter = {
			username: '',
			orderBy: 'username',
			orderMode: '+',
			minMatches: $scope.service.min_matches,
		};

		$scope.fetch = function(user) {
			console.log("user 1 : ", user);
			var matches = scrap.fetch(user.nickname).then(function (datas) {
				$timeout(function () {
			        $scope.$apply(function () {
			            $scope.data = datas;
			            $scope.service.progress = 100;
			        });
			    }, 150);
				console.log("stats : ", datas);
			}, function(error) {
				console.log(error);
			});
		};
	}]);
})();
