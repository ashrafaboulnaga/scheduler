/**
 * scheduler
 */
var schedulerApp = angular.module('Scheduler', ['ui.bootstrap.modal', 'ui.bootstrap.dropdown', 'ui.bootstrap.tooltip']);

schedulerApp.filter('addZero', function(){
   return function(value){
     var valueInt = parseInt(value);
      if(!isNaN(value) && value > 0 && value < 10)
         return "0"+ valueInt;
      return valueInt;
   }
});

schedulerApp.filter('nospace', function () {
    return function (value) {
        return (!value) ? '' : value.replace(/ /g, '');
    };
});
	
schedulerApp.directive('ngFocus', function($timeout) {
    return {
        link: function ( scope, element, attrs ) {
            scope.$watch( attrs.ngFocus, function ( val ) {
                if ( angular.isDefined( val ) && val ) {
                    $timeout( function () { element[0].focus(); } );
                }
            }, true);

            element.bind('blur', function () {
                if ( angular.isDefined( attrs.ngFocusLost ) ) {
                    scope.$apply( attrs.ngFocusLost );

                }
            });
        }
    };
});

schedulerApp.factory('multipleDatePickerBroadcast', ['$rootScope', function ($rootScope) {
    var sharedService = {};

    sharedService.calendarId = null;
    sharedService.message = '';

    sharedService.resetOrder = function (calendarId) {
        this.message = 'reset';
        this.calendarId = calendarId;
        this.broadcastItem();
    };

    sharedService.broadcastItem = function () {
        $rootScope.$broadcast('handleMultipleDatePickerBroadcast');
    };

    return sharedService;
}]);
    
schedulerApp.directive('multipleDatePicker', ['$log', 'multipleDatePickerBroadcast', function ($log, multipleDatePickerBroadcast) {
	"use strict";
    return {
        restrict: 'AE',
        scope: {
            /*
             * Type : String/Long (avoid 0 value)
             * Will be used to identified calendar when using broadcast messages
             * */
            calendarId: '=?',
            dayClick: '=?',
            dayHover: '=?',

            /*
             * Type: moment date
             * Month to be displayed
             * Default is current month
             */
            month: '=?',

            /*
             * Type: function(newMonth, oldMonth)
             * Will be called when month changed
             * Param newMonth/oldMonth will be the first day of month at midnight
             * */
            monthChanged: '=?',
            /*
             * Type: array of milliseconds timestamps
             * Days already selected
             * */
            daysSelected: '=?',
            /*
             * Type: array of integers
             * Recurrent week days not selectables
             * /!\ Sunday = 0, Monday = 1 ... Saturday = 6
             * */
            weekDaysOff: '=?',
            /*
             * Type: array of objects cf doc
             * Days highlights
             * */
            highlightDays: '=?',
            /*
             * Type: boolean
             * Set all days off
             * */
            allDaysOff: '=?',
            /*
             * Type: boolean
             * Sunday be the first day of week, default will be Monday
             * */
            sundayFirstDay: '=?',
            /*
             * Type: boolean
             * if true can't go back in months before today's month
             * */
            disallowBackPastMonths: '=?',
            /*
             * Type: boolean
             * if true can't go in futur months after today's month
             * */
            disallowGoFuturMonths: '=?',
            /*
             * Type: boolean
             * if true empty boxes will be filled with days of previous/next month
             * */
            showDaysOfSurroundingMonths: '=?',
            /*
             * Type: string
             * CSS classes to apply to days of next/previous months
             * */
            cssDaysOfSurroundingMonths: '=?',
            /*
             * Type: boolean
             * if true events on empty boxes (or next/previous month) will be fired
             * */
            fireEventsForDaysOfSurroundingMonths: '=?',
            /*
             * Type: any type moment can parse
             * If filled will disable all days before this one (not included)
             * */
            disableDaysBefore: '=?',
            /*
             * Type: any type moment can parse
             * If filled will disable all days after this one (not included)
             * */
            disableDaysAfter: '=?',
            
            convertedDaysSelected: '='
        },
        template: '<div class="multiple-date-picker">' +
        '<div class="picker-top-row">' +
        '<div class="text-center picker-navigate picker-navigate-left-arrow" ng-class="{\'disabled\':disableBackButton}" ng-click="previousMonth()">&lt;</div>' +
        '<div class="text-center picker-month">{{month.format(\'MMMM YYYY\')}}</div>' +
        '<div class="text-center picker-navigate picker-navigate-right-arrow" ng-class="{\'disabled\':disableNextButton}" ng-click="nextMonth()">&gt;</div>' +
        '</div>' +
        '<div class="picker-days-week-row">' +
        '<div class="text-center" ng-repeat="day in daysOfWeek">{{day}}</div>' +
        '</div>' +
        '<div class="picker-days-row">' +
        '<div class="text-center picker-day {{!day.otherMonth || showDaysOfSurroundingMonths ? day.css : \'\'}} {{day.otherMonth ? cssDaysOfSurroundingMonths : \'\'}}" title="{{day.title}}" ng-repeat="day in days" ng-click="toggleDay($event, day)" ng-mouseover="hoverDay($event, day)" ng-mouseleave="dayHover($event, day)" ng-class="{\'picker-selected\':day.selected, \'picker-off\':!day.selectable, \'today\':day.today,\'past\':day.past,\'future\':day.future, \'picker-other-month\':day.otherMonth}">{{day ? day.otherMonth && !showDaysOfSurroundingMonths ? \'&nbsp;\' : day.format(\'D\') : \'\'}}</div>' +
        '</div>' +
        '</div>',
        link: function (scope) {

            /*utility functions*/
            var checkNavigationButtons = function () {
                    var today = moment(),
                        previousMonth = moment(scope.month).subtract(1, 'month'),
                        nextMonth = moment(scope.month).add(1, 'month');
                    scope.disableBackButton = scope.disallowBackPastMonths && today.isAfter(previousMonth, 'month');
                    scope.disableNextButton = scope.disallowGoFuturMonths && today.isBefore(nextMonth, 'month');
                },
                getDaysOfWeek = function () {
                    /*To display days of week names in moment.lang*/
                    var momentDaysOfWeek = moment().localeData()._weekdaysMin,
                        days = [];

                    for (var i = 1; i < 7; i++) {
                        days.push(momentDaysOfWeek[i]);
                    }

                    if (scope.sundayFirstDay) {
                        days.splice(0, 0, momentDaysOfWeek[0]);
                    } else {
                        days.push(momentDaysOfWeek[0]);
                    }

                    return days;
                },
                reset = function () {
                    var daysSelected = scope.daysSelected || [],
                        momentDates = [];
                    daysSelected.map(function (timestamp) {
                        momentDates.push(moment(timestamp));
                    });
                    scope.convertedDaysSelected = momentDates;
                    scope.generate();
                };

            /* broadcast functions*/
            scope.$on('handleMultipleDatePickerBroadcast', function () {
                if (multipleDatePickerBroadcast.message === 'reset' && (!multipleDatePickerBroadcast.calendarId || multipleDatePickerBroadcast.calendarId === scope.calendarId)) {
                    reset();
                }
            });

            /*scope functions*/
            scope.$watch('daysSelected', function (newValue) {
                if (newValue) {
                    reset();
                }
            }, true);

            scope.$watch('weekDaysOff', function () {
                scope.generate();
            }, true);

            scope.$watch('highlightDays', function () {
                scope.generate();
            }, true);

            scope.$watch('allDaysOff', function () {
                scope.generate();
            }, true);
            
            scope.$watch('convertedDaysSelected', function () {
                scope.generate();
            }, true);

            //default values
            scope.month = scope.month || moment().startOf('day');
            scope.convertedDaysSelected = scope.convertedDaysSelected || [];
            scope.weekDaysOff = scope.weekDaysOff || [];
            scope.daysOff = scope.daysOff || [];
            scope.disableBackButton = false;
            scope.disableNextButton = false;
            scope.daysOfWeek = getDaysOfWeek();
            scope.cssDaysOfSurroundingMonths = scope.cssDaysOfSurroundingMonths || 'picker-empty';

            /**
             * Called when user clicks a date
             * @param Event event the click event
             * @param Moment momentDate a moment object extended with selected and isSelectable booleans
             * @see #momentDate
             * @callback dayClick
             */
            scope.toggleDay = function (event, momentDate) {
                event.preventDefault();

                if(momentDate.otherMonth && !scope.fireEventsForDaysOfSurroundingMonths){
                    return;
                }

                var prevented = false;

                event.preventDefault = function () {
                    prevented = true;
                };

                if (typeof scope.dayClick == 'function') {
                    scope.dayClick(event, momentDate);
                }

                if (momentDate.selectable && !prevented) {
                    momentDate.selected = !momentDate.selected;

                    if (momentDate.selected) {
                        scope.convertedDaysSelected.push(momentDate);
                    } else {
                        scope.convertedDaysSelected = scope.convertedDaysSelected.filter(function (date) {
                            return date.valueOf() !== momentDate.valueOf();
                        });
                    }
                }
            };

            /**
             * Hover day
             * @param Event event
             * @param Moment day
             */
            scope.hoverDay = function (event, day) {
                event.preventDefault();
                var prevented = false;

                event.preventDefault = function () {
                    prevented = true;
                };

                if (typeof scope.dayHover == 'function') {
                    scope.dayHover(event, day);
                }

                if (!prevented) {
                    day.hover = event.type === 'mouseover' ? true : false;
                }
            };

            /*Navigate to previous month*/
            scope.previousMonth = function () {
                if (!scope.disableBackButton) {
                    var oldMonth = moment(scope.month);
                    scope.month = scope.month.subtract(1, 'month');
                    if (typeof scope.monthChanged == 'function') {
                        scope.monthChanged(scope.month, oldMonth);
                    }
                    scope.generate();
                }
            };

            /*Navigate to next month*/
            scope.nextMonth = function () {
                if (!scope.disableNextButton) {
                    var oldMonth = moment(scope.month);
                    scope.month = scope.month.add(1, 'month');
                    if (typeof scope.monthChanged == 'function') {
                        scope.monthChanged(scope.month, oldMonth);
                    }
                    scope.generate();
                }
            };

            /*Check if the date is off : unselectable*/
            scope.isDayOff = function (scope, date) {
                return scope.allDaysOff ||
                    (!!scope.disableDaysBefore && moment(date).isBefore(scope.disableDaysBefore, 'day')) ||
                    (!!scope.disableDaysAfter && moment(date).isAfter(scope.disableDaysAfter, 'day')) ||
                    (angular.isArray(scope.weekDaysOff) && scope.weekDaysOff.some(function (dayOff) {
                        return date.day() === dayOff;
                    })) ||
                    (angular.isArray(scope.daysOff) && scope.daysOff.some(function (dayOff) {
                        return date.isSame(dayOff, 'day');
                    })) ||
                    (angular.isArray(scope.highlightDays) && scope.highlightDays.some(function (highlightDay) {
                        return date.isSame(highlightDay.date, 'day') && !highlightDay.selectable;
                    }));
            };

            /*Check if the date is selected*/
            scope.isSelected = function (scope, date) {
                return scope.convertedDaysSelected.some(function (d) {
                    return date.isSame(d, 'day');
                });
            };

            /*Generate the calendar*/
            scope.generate = function () {
                var previousDay = moment(scope.month).date(0).day(scope.sundayFirstDay ? 0 : 1).subtract(1, 'days'),
                    firstDayOfMonth = moment(scope.month).date(1),
                    days = [],
                    now = moment(),
                    lastDay = moment(firstDayOfMonth).endOf('month'),
                    createDate = function () {
                        var date = moment(previousDay.add(1, 'days'));
                        if (angular.isArray(scope.highlightDays)) {
                            var hlDay = scope.highlightDays.filter(function (d) {
                                return date.isSame(d.date, 'day');
                            });
                            date.css = hlDay.length > 0 ? hlDay[0].css : '';
                            date.title = hlDay.length > 0 ? hlDay[0].title : '';
                        }
                        date.selectable = !scope.isDayOff(scope, date);
                        date.selected = scope.isSelected(scope, date);
                        date.today = date.isSame(now, 'day');
                        date.past = date.isBefore(now, 'day');
                        date.future = date.isAfter(now, 'day');
                        if (!date.isSame(scope.month, 'month')) {
                            date.otherMonth = true;
                        }
                        return date;
                    },
                    maxDays = lastDay.diff(previousDay, 'days'),
                    lastDayOfWeek = scope.sundayFirstDay ? 6 : 0;

                if (lastDay.day() !== lastDayOfWeek) {
                    maxDays += (scope.sundayFirstDay ? 6 : 7) - lastDay.day();
                }

                for (var j = 0; j < maxDays; j++) {
                    days.push(createDate());
                }

                scope.days = days;
                checkNavigationButtons();
            };

            scope.generate();
        }
    };
}]);

schedulerApp.controller('SchedulerCtrl', function($rootScope, $scope, $compile, $timeout, $http, $sce, $filter) {
	$scope.events = [];
	$scope.invitations = [];
	$scope.contacts = [];
	$scope.convertedDaysSelected = {value : []};
	$scope.newTimes = {};
	$scope.newPartecipants = [];
	$scope.hoursSelected = ["00","01","02","03","04","05","06","07","08","09","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24"];
	$scope.loggedin = false;
	$scope.storageExists = false;
    $scope.userProfile = {};
    $scope.newevent = {};
    $scope.metadata = "app-scheduler";
    $scope.prefix = "sched_event_";
    $scope.prefixInvitation = "sched_invitation_";
    $scope.prefixResponse = "sched_response_";
    $scope.appurl = "http://mzereba.github.io/scheduler/";
    $scope.apptypes = ["https://meccano.io/scheduler#"];
    $scope.current_id = -1;
	$scope.last_id = -1;
	$scope.current_event = {};
	$scope.current_responses = [];
    
    var CREATE = 0;
    var UPDATE = 1;
            
    var providerURI = '//linkeddata.github.io/signup/index.html?ref=';
    $scope.widgetURI = $sce.trustAsResourceUrl(providerURI+window.location.protocol+'//'+window.location.host);
    
    // Define the appuri, used as key when saving to sessionStorage
    $scope.appuri = window.location.origin;
    
    $scope.status = {
        isopen: false
	};

	$scope.toggled = function(open) {
		$log.log('Dropdown is now: ', open);
	};
	

	$scope.toggleDropdown = function($event) {
		$event.preventDefault();
		$event.stopPropagation();
		$scope.status.isopen = !$scope.status.isopen;
	};
	
	$scope.setStyle = function (index) {
		if ($scope.current_id == index) {
			//return {'border': '2px solid #ffffff', 'box-shadow': '0 5px 10px rgba(0, 0, 0, 0.2)'}
			return {'border': '2px solid #ffffff'}
		}
		if ($scope.last_id == index) {
			return {}
		}
	};
	
	$scope.select = function (index, event) {
		$scope.last_id = $scope.current_id; 
		$scope.current_id = index;
		$scope.current_event = angular.copy(event);
		$scope.loadResponses($scope.current_event);
	};
	
	$scope.reset = function() {
    	if($scope.events.length > 0) {
    		$scope.select($scope.events.length-1, $scope.events[$scope.events.length-1]);
    	} else {
    		$scope.current_id = -1;
        	$scope.last_id = -1;
    	}
    };
    
    $scope.isChecked = function (webid, date) {
    	for(i in $scope.current_responses) {
    		var response = $scope.current_responses[i];
    		if(response.partecipant == webid){
    			if(response.confirmed.length != 0){
       				if(response.confirmed.indexOf(date.getTime()) !== -1)
    					return true;    				
    			}
    		}
    	}
	};
		
	$scope.isDisabled = function (me, webid) {
		if(angular.equals(me, webid))
			return true;
		else
			return false;
	};	
		
	$scope.acceptInvitation = function (i) {	
		$scope.loadGuestEvent($scope.invitations[i]);
	};
	
	// Simply returns item matching given value
    $scope.get = function (items, value) {
        for (i in items) {
            if (items[i] == value) {
                return items[i];
            }
        }
    };
    
    // Simply returns item matching given id
    $scope.getById = function (items, value) {
        for (i in items) {
            if (items[i].id == value) {
                return items[i];
            }
        }
    };
    
    // Gets the index of an item in an array
    $scope.getIndex = function (items, value) {
	    for (i in items) {
	        if (items[i] == value) {
	        	return i;
	        }
	    }
    };
    
    $scope.authenticate = function(webid) {
        if (webid.slice(0,4) == 'http') {
        	$scope.loggedin = true;
            notify('Success', 'Authenticated user.');
        } else {
            notify('Failed', 'Authentication failed.');
        }
    };
       
    // Save profile object in sessionStorage after login
    $scope.saveCredentials = function () {
        var app = {};
        var _user = {};
        app.userProfile = $scope.userProfile;
        sessionStorage.setItem($scope.appuri, JSON.stringify(app));
    };
    
    // Logs user out
    $scope.logout = function() {
    	$scope.events.length = 0;
    	$scope.userProfile = {};
    	$scope.clearLocalCredentials();
    	$scope.loggedin = false;
    };
    
    // Clears sessionStorage on logout
    $scope.clearLocalCredentials = function () {
        sessionStorage.removeItem($scope.appuri);
    };
    
    $scope.openAuth = function() {
    	$scope.authenticationModal = true;	 
    };
    
    $scope.closeAuth = function() {
    	$scope.authenticationModal = false;
    };
    
    // Opens the pop up for creating an event
    $scope.add = function() {
    	$scope.contact = $scope.contacts[0];
    	$scope.modalTitle = "New Event";
    	$scope.addEventModal = true;
    	$scope.newevent = {};
    	$scope.isFocused = true;
    };
    
    // Adds member to the list
    $scope.addPartecipant = function(contact) {
    	$scope.newPartecipants.push(contact); 
    };
    
    // Simply search event list for given contact
    // and replaces the contact object if found
    $scope.replace = function (event) {
        for (i in $scope.events) {
            if ($scope.events[i].id == event.id) {
                $scope.events[i] = angular.copy(event);
            }
        }
    };
    
    // Creates an event resource
    $scope.save = function(newevent) {
    	if (newevent.id == null) {
            //if this is new event, add it in events array
    		//generate unique id
    		newevent.id = new Date().getTime();
    		
    		newevent.organizer = $scope.userProfile.webid;
    		
    		newevent.origin_url = $filter('nospace') ($scope.userProfile.schedulerStorage + newevent.title + "/");
    		
    		newevent.partecipants = [];
    		newevent.partecipants.push(newevent.organizer);
    		for(i in $scope.newPartecipants) {
    			newevent.partecipants.push($scope.newPartecipants[i].webid);
    		}
    		
    		newevent.proposed = [];
    		for(j in $scope.newTimes) {
        		var aDate = j.split("_");
        		var year = aDate[2];
            	var month = aDate[1] - 1;
            	var day = aDate[0];
            	var hour = $scope.newTimes[j];
        		var date = new Date(year, month, day, hour);
        		newevent.proposed.push(date);
        	}
    		
    		//build event resource and insert
    		$scope.isContainerNameExisting(newevent);
        } else {
            //for existing event, find this event using id
            //and update it.
            for (i in $scope.events) {
                if ($scope.events[i].id == newevent.id) {
                	$scope.insertEvent(newevent, UPDATE);
                }
            }
        }
    };
    
    $scope.addResponse = function (webid, date) {
		for(i in $scope.current_responses) {
    		var response = $scope.current_responses[i];
    		if(response.partecipant == webid) {
    			if(response.confirmed.length != 0) {
	    			if(response.confirmed.indexOf(date.getTime()) !== -1)
	    				response.confirmed.splice(response.confirmed.indexOf(date.getTime()), 1);
	    			else
	    				response.confirmed.push(date.getTime());
    			} else {
    				response.confirmed.push(date.getTime());
    			}
    			
    			$scope.current_responses[i] = angular.copy(response);
				$scope.insertResponse(response, $scope.current_event, UPDATE);
				return;
    		}
    	}
	};
    
    $scope.closeEditor = function() {
    	$scope.addEventModal = false;
    	$scope.isFocused = false;
    	$scope.convertedDaysSelected = {value : []};
 		$scope.newTimes = {};
 		$scope.newPartecipants = [];
    	$scope.newevent = {};
    	$scope.errorTitle = "";
    };
    
    $scope.myInvitations = function() {
    	$scope.modalTitle = "My Invitations";
    	$scope.myInvitationsModal = true;
    	$scope.isFocused = true;
    	$scope.noteTitle = "";
    };
    
    $scope.closeMyInvitations = function() {
    	$scope.myInvitationsModal = false;
    	$scope.isFocused = false;
    };
    
    $scope.myStorage = function() {
    	$scope.modalTitle = "My Storage";
    	$scope.myStorageModal = true;
    	$scope.mystorage = {};
    	$scope.mystorage.workspace = $scope.userProfile.workspaces[0];
    	$scope.isFocused = true;
    	$scope.noteTitle = "";
    	
    	if($scope.userProfile.schedulerStorage != null) {
    		var split = $scope.userProfile.schedulerStorage.split("/");
    		var ws ="";
    		$scope.mystorage.storagename = split[split.length-2];
    		for(var i=0; i<split.length-2; i++){
    			ws += split[i] + "/";
    		}
    		$scope.mystorage.workspace = $scope.get($scope.userProfile.workspaces, ws);
    	}else{
    		$scope.noteTitle = "Please create a storage location for your scheduler events";
    	}
    };
    
    $scope.closeMyStorage = function() {
    	$scope.myStorageModal = false;
    	$scope.isFocused = false;
    	$scope.mystorage = {};
    };
    
    $scope.newStorage = function(mystorage) {
    	var storage = mystorage.workspace + mystorage.storagename + "/";
    	var dir = $scope.userProfile.preferencesDir;
    	var uri = dir + $scope.metadata;  
    	$scope.createOrUpdateMetadata(uri, CREATE, storage);
    	$scope.closeMyStorage();
    };
    
    $scope.checkStorage = function(mystorage) {
    	$scope.isContainerExisting(mystorage);
    };

    // Gets workspaces
    $scope.getWorkspaces = function (uri) {
		var g = $rdf.graph();
	    var f = $rdf.fetcher(g);
	    f.nowOrWhenFetched(uri,undefined,function(){	
		    var DC = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
			var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
			var SPACE = $rdf.Namespace('http://www.w3.org/ns/pim/space#');
	
			var evs = g.statementsMatching($rdf.sym($scope.userProfile.webid), SPACE('preferencesFile'), $rdf.sym(uri));
			if (evs.length > 0) {
                var workspaces = [];
				for (var e in evs) {
					var ws = g.statementsMatching(evs[e]['subject'], SPACE('workspace'));
					
					for (var s in ws) {
						var workspace = ws[s]['object']['value'];
						workspaces.push(workspace);
					}
                    //$scope.$apply();
                }
                $scope.userProfile.workspaces = workspaces;
                $scope.saveCredentials();
                $scope.$apply();
			}
			
			$scope.isMetadataExisting();
	    });
    };
    
    // Gets user info
    $scope.getUserInfo = function () {
		var g = $rdf.graph();
	    var f = $rdf.fetcher(g);
	    var uri = ($scope.userProfile.webid.indexOf('#') >= 0)?$scope.userProfile.webid.slice(0, $scope.userProfile.webid.indexOf('#')):$scope.userProfile.webid;
	    
	    f.nowOrWhenFetched(uri ,undefined,function(){	
		    var DC = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
			var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
			var LDP = $rdf.Namespace('http://www.w3.org/ns/ldp#');
			var SPACE = $rdf.Namespace('http://www.w3.org/ns/pim/space#');
			var TERMS = $rdf.Namespace('http://www.w3.org/ns/solid/terms#');
			var FOAF = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
	
			var evs = g.statementsMatching($rdf.sym($scope.userProfile.webid), RDF('type'), FOAF('Person'));
			if (evs.length > 0) {
				for (var e in evs) {
					var storage = g.anyStatementMatching(evs[e]['subject'], SPACE('storage'))['object']['value'];
					var prfs = g.anyStatementMatching(evs[e]['subject'], SPACE('preferencesFile'))['object']['value'];
					var inbox = g.anyStatementMatching(evs[e]['subject'], TERMS('inbox'))['object']['value'];
					
					var fullnamePredicate = g.anyStatementMatching(evs[e]['subject'], FOAF('name'));
					var fullname = "";
					if(fullnamePredicate != null)
						fullname = fullnamePredicate ['object']['value'];
					else
						fullname = $scope.userProfile.webid;
					
					var imagePredicate = g.anyStatementMatching(evs[e]['subject'], FOAF('img'));
					var image = "";
					if(imagePredicate != null)
						image = imagePredicate ['object']['value'];
					else
						image = "images/generic_photo.png";

					$scope.userProfile.storage = storage;
                    if (prfs && prfs.length > 0) {
                        $scope.userProfile.preferencesFile = prfs;
                        $scope.getWorkspaces(prfs);

                        var split = $scope.userProfile.preferencesFile.split("/");
                        var prfsDir = "";
                        for(var i=0; i<split.length-1; i++){
                            prfsDir += split[i] + "/";
                        }
                        
                        $scope.userProfile.preferencesDir = prfsDir;
                    } 
                    
                    $scope.userProfile.inbox = inbox;
				    $scope.userProfile.fullname = fullname;
					$scope.userProfile.image = image;
				    
					//$scope.saveCredentials();
                    //$scope.$apply();
                }
			}
			
            //$scope.getEndPoint($scope.userProfile.storage);
	    });  
    };
            
    // Gets scheduler storage
    $scope.getStorage = function (uri) {
		var g = $rdf.graph();
	    var f = $rdf.fetcher(g);
	    
	    f.nowOrWhenFetched(uri + '',undefined,function(){	
		    var DC = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
			var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
			var APP = $rdf.Namespace('https://example.com/');
			var SPACE = $rdf.Namespace('http://www.w3.org/ns/pim/space#');
	
			var evs = g.statementsMatching(undefined, RDF('type'), APP('application'));
			if (evs != undefined) {
				for (var e in evs) {
					var id = evs[e]['subject']['value'];
					var storage = g.anyStatementMatching(evs[e]['subject'], SPACE('storage'))['object']['value'];
					
					$scope.userProfile.schedulerStorage = storage;
					$scope.saveCredentials();
					$scope.storageExists = true;
                    $scope.$apply();
                }
			}
			//fetch user events
			$scope.loadSchedulerContainers($scope.userProfile.schedulerStorage);
			$scope.loadInvitations($scope.userProfile.inbox);
	    });
    };
    
    // Gets contacts index
    $scope.getContactsIndex = function () {
    	var uri = $scope.userProfile.preferencesDir;
	    var g = $rdf.graph();
	    var f = $rdf.fetcher(g);
	    
	    f.nowOrWhenFetched(uri + '*',undefined,function(){	
		    var DC = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
			var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
			var VCARD = $rdf.Namespace('http://www.w3.org/2006/vcard/ns#');
			var SPACE = $rdf.Namespace('http://www.w3.org/ns/pim/space#');
	
			var evs = g.statementsMatching(undefined, RDF('type'), VCARD('Individual'));
			if (evs != undefined) {
				for (var e in evs) {
					var fullname = g.anyStatementMatching(evs[e]['subject'], VCARD('fn'))['object']['value'];
					var uid = g.anyStatementMatching(evs[e]['subject'], VCARD('hasUID'))['object']['value'];
					
					var id = evs[e]['subject']['value'];
					var sId = id.split("_"); 
					if(sId[1] != "0"){
						var contact = {
							    fullname: fullname,
							    webid: uid
						}
						$scope.contacts.push(contact);
					}
                    $scope.$apply();
                }
			}
	    });
    };
    
    // Lists containers resources
    $scope.loadSchedulerContainers = function (uri) {
		var containers = [];
    	var g = $rdf.graph();
		var f = $rdf.fetcher(g);
	    f.nowOrWhenFetched(uri ,undefined,function() {
	    	var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
		    var TITLE = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
			var TIMELINE = $rdf.Namespace('http://purl.org/NET/c4dm/timeline.owl#');
			var EVENT = $rdf.Namespace('https://meccano.io/scheduler#');
			var LDP = $rdf.Namespace('http://www.w3.org/ns/ldp#');
			var STAT = $rdf.Namespace('http://www.w3.org/ns/posix/stat#');
			
			var evs = g.statementsMatching(undefined, RDF('type'), LDP('Container'));
			if (evs != undefined) {
				for (var e in evs) {
					var contains = g.statementsMatching(evs[e]['subject'], LDP('contains'));
					for (var c in contains) {
						var container = contains[c]['object']['value'];
						containers.push(container);
						$scope.$apply();
					}															
                }
			}
			
			$scope.loopSchedulerContainers(containers);
	    });
    };
    
    // Loops through events container 
    $scope.loopSchedulerContainers = function (containers) {
    	for (var i in containers) {
    		if(i == containers.length-1)
    			$scope.loadEvent(containers[i], UPDATE);
    		else
    			$scope.loadEvent(containers[i], CREATE);
    	}
    };
    
    // Lists event resources
    $scope.loadEvent = function (uri, OPERATION) {
		var g = $rdf.graph();
		var f = $rdf.fetcher(g);
	    f.nowOrWhenFetched(uri + '*',undefined,function() {
	    	var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
		    var TITLE = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
			var TIMELINE = $rdf.Namespace('http://purl.org/NET/c4dm/timeline.owl#');
			var EVENT = $rdf.Namespace('https://meccano.io/scheduler#');
			var MAKER = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
			
			var e = 0;
			var evs = g.statementsMatching(undefined, RDF('type'), EVENT('schedulerEvent'));
			if (evs != undefined) {
				for (e in evs) {
					var id = evs[e]['subject']['value']; 
					var sId = id.split("_");
					
					var title = g.anyStatementMatching(evs[e]['subject'], EVENT('title'))['object']['value'];
					
					var description = g.anyStatementMatching(evs[e]['subject'], EVENT('description'))['object']['value'];
					
					var organizer = g.anyStatementMatching(evs[e]['subject'], EVENT('organizer'))['object']['value'];
					
					var origin = g.anyStatementMatching(evs[e]['subject'], EVENT('origin_url'))['object']['value'];
					var origin_string = "";
					var aOrigin = origin.split("/");
					for(o=0; o<aOrigin.length-1; o++) {
						origin_string += aOrigin[o] + "/";
 					}
					
					var proposed = g.statementsMatching(evs[e]['subject'], EVENT('proposed'));
					var dates = [];
					for (var p in proposed) {
						var prop = proposed[p]['object']['value'];
						var date = new Date(prop);
						date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
						dates.push(date);
					}
										
					var attendee = g.statementsMatching(evs[e]['subject'], EVENT('attendee'));
					var partecipants = [];
					for (var a in attendee) {
						var att = attendee[a]['object']['value'];
						partecipants.push(att);
					}
															
					var event = {
					    id: sId[sId.length-1],
					    title: title,
					    description: description,
					    proposed: dates,
					    partecipants: partecipants,
					    organizer: organizer,
					    origin_url: origin_string
					}
										
					$scope.events.push(event);
                    $scope.$apply();
                }
			}
			
			if(OPERATION == UPDATE)
				$scope.reset();
	    });  
    };
    
    // Lists guest event resources
    $scope.loadGuestEvent = function (invitation) {
		var event = {};
    	var g = $rdf.graph();
		var f = $rdf.fetcher(g);
	    f.nowOrWhenFetched(invitation.origin_url + '*',undefined,function() {
	    	var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
		    var TITLE = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
			var TIMELINE = $rdf.Namespace('http://purl.org/NET/c4dm/timeline.owl#');
			var EVENT = $rdf.Namespace('https://meccano.io/scheduler#');
			var MAKER = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
			
			var evs = g.statementsMatching(undefined, RDF('type'), EVENT('schedulerEvent'));
			if (evs != undefined) {
				for (var e in evs) {
					var id = evs[e]['subject']['value']; 
					
					var title = g.anyStatementMatching(evs[e]['subject'], EVENT('title'))['object']['value'];
					
					var description = g.anyStatementMatching(evs[e]['subject'], EVENT('description'))['object']['value'];
					
					var organizer = g.anyStatementMatching(evs[e]['subject'], EVENT('organizer'))['object']['value'];
					
					var origin = g.anyStatementMatching(evs[e]['subject'], EVENT('origin_url'))['object']['value'];
					
					var proposed = g.statementsMatching(evs[e]['subject'], EVENT('proposed'));
					var dates = [];
					for (var p in proposed) {
						var prop = proposed[p]['object']['value'];
						var date = new Date(prop);
						date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
						dates.push(date);
					}
										
					var attendee = g.statementsMatching(evs[e]['subject'], EVENT('attendee'));
					var partecipants = [];
					for (var a in attendee) {
						var att = attendee[a]['object']['value'];
						partecipants.push(att);
					}
															
					event = {
					    id: "",
					    title: title,
					    description: description,
					    proposed: dates,
					    partecipants: partecipants,
					    organizer: organizer,
					    origin_url: invitation.origin_url
					}
                }
			}
			
			$scope.insertGuestEvent(event, invitation);
	    });  
    };
    
    // Lists events invitation resources
    $scope.loadInvitations = function (uri) {
		var g = $rdf.graph();
		var f = $rdf.fetcher(g);
	    f.nowOrWhenFetched(uri + '*',undefined,function() {
	    	var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
		    var TITLE = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
			var TIMELINE = $rdf.Namespace('http://purl.org/NET/c4dm/timeline.owl#');
			var EVENT = $rdf.Namespace('https://meccano.io/scheduler#');
			var MAKER = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
			
			var evs = g.statementsMatching(undefined, RDF('type'), EVENT('schedulerInvitation'));
			if (evs != undefined) {
				for (var e in evs) {
					var id = evs[e]['subject']['value']; 
					
					var title = g.anyStatementMatching(evs[e]['subject'], EVENT('title'))['object']['value'];
					
					var description = g.anyStatementMatching(evs[e]['subject'], EVENT('description'))['object']['value'];
					
					var organizer = g.anyStatementMatching(evs[e]['subject'], EVENT('organizer'))['object']['value'];
					
					var url = g.anyStatementMatching(evs[e]['subject'], EVENT('origin_url'))['object']['value'];
																				
					var invitation = {
					    id: id,
					    title: title,
					    description: description,
					    organizer: organizer,
					    origin_url: url
					}
										
					$scope.invitations.push(invitation);
                    $scope.$apply();
                }
			}
			
	    });  
    };
    
    // Lists events response resources
    $scope.loadResponses = function (event) {
		$scope.current_responses = [];
    	var g = $rdf.graph();
		var f = $rdf.fetcher(g);
	    f.nowOrWhenFetched(event.origin_url + '*',undefined,function() {
	    	var RDF = $rdf.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
		    var TITLE = $rdf.Namespace('http://purl.org/dc/elements/1.1/');
			var TIMELINE = $rdf.Namespace('http://purl.org/NET/c4dm/timeline.owl#');
			var EVENT = $rdf.Namespace('https://meccano.io/scheduler#');
			var MAKER = $rdf.Namespace('http://xmlns.com/foaf/0.1/');
			
			var evs = g.statementsMatching(undefined, RDF('type'), EVENT('schedulerResponse'));
			if (evs != undefined) {
				for (var e in evs) {
					var id = evs[e]['subject']['value'];
					var sId = id.split("/");
					var sId1 = sId[sId.length-1].split("_");
					
					var partecipant = g.anyStatementMatching(evs[e]['subject'], EVENT('partecipant'))['object']['value'];
					
					var confirmed = g.statementsMatching(evs[e]['subject'], EVENT('confirmed'));
					var dates = [];
					if(confirmed.length != 0) {
						for(c in confirmed) {
							var conf = confirmed[c]['object']['value'];
							var date = new Date(conf);
							date = new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
							dates.push(date.getTime());
						}
					}
					
					var response = {
					    id: sId1[sId1.length-1],
					    partecipant: partecipant,
					    confirmed: dates
					}
										
					$scope.current_responses.push(response);
                    $scope.$apply();
                }
			}
			
			$scope.$digest();
	    });  
    };
            
    // Check if metadata for scheduler app exists, if not create it
    $scope.isMetadataExisting = function () {
    	var uri = $scope.userProfile.preferencesDir;
	    uri += $scope.metadata;
	    
        $http({
          method: 'HEAD',
          url: uri,
          withCredentials: true
        }).
        success(function(data, status, headers) {
        	//container found, load metadata
        	$scope.getStorage(uri);
        	$scope.getContactsIndex();
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create a directory for: '+$scope.user);
          } else if (status == 403) {
        	  notify('Forbidden', 'You are not allowed to access storage for: '+$scope.user);
          } else if (status == 404) {
        	  //open dialog to create metadata containing scheluder storage
        	  $scope.myStorage();
          } else {
        	  notify('Failed - HTTP '+status, data, 5000);
          }
        });
    };
    
    // Creates or updates scheduler metadata
    $scope.createOrUpdateMetadata = function (uri, action, container) {
    	var resource = $scope.metadataTemplate(uri, container);
		$http({
          method: 'PUT', 
	      url: uri,
          data: resource,
          headers: {
            'Content-Type': 'text/turtle',
            'Link': '<http://www.w3.org/ns/ldp#Resource>; rel="type"'
          },
          withCredentials: true
        }).
        success(function(data, status, headers) {
          if (status == 200 || status == 201) {
            if(action == CREATE){
            	notify('Success', uri + " created");
            	$scope.createContainer(action, container);
            } else {
            	notify('Success', uri + " updated");
            	$scope.createContainer(action, container);
            }
          }
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create new directory.');
          } else if (status == 403) {
            notify('Forbiddenn', 'You are not allowed to create new directory.');
          } else {
            notify('Failed: '+ status + data);
          }
        });
    };
            
    // Creates container
    $scope.createContainer = function (action, container) {
    	var uri = container;
	    
		$http({
          method: 'PUT', 
	      url: uri,
          data: '',
          headers: {
            'Content-Type': 'text/turtle',
			'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"'
          },
          withCredentials: true
        }).
        success(function(data, status, headers) {
          if (status == 200 || status == 201) {
        	  notify('Success', 'scheduler container has been created under ' + container);
        	  var path = $scope.userProfile.preferencesDir + $scope.metadata;
        	  $scope.getStorage(path);
          }
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create new directory.');
          } else if (status == 403) {
            notify('Forbiddenn', 'You are not allowed to create new directory.');
          } else {
            notify('Failed: '+ status + data);
          }
        });
    };
    
    // Check if a scheduler container name exists
    $scope.isContainerNameExisting = function (event) {
    	var uri = $scope.userProfile.schedulerStorage + event.title + "/";
        $http({
          method: 'HEAD',
          url: uri,
          withCredentials: true
        }).
        success(function(data, status, headers) {
        	//container found, warn user to create a different one
        	$scope.errorTitle = "*Event name already existing! ";
    		$scope.$digest();      
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create a directory for: '+$scope.user);
          } else if (status == 403) {
        	  notify('Forbidden', 'You are not allowed to access storage for: '+$scope.user);
          } else if (status == 404) {
        	  //container not existing, proceed
        	  $scope.createSchedulerContainer(event, CREATE);
          } else {
        	  notify('Failed - HTTP '+status, data, 5000);
          }
        });
    };
    
    // Creates a scheduler container
    $scope.createSchedulerContainer = function (event, action) {
    	var uri = $scope.userProfile.schedulerStorage + event.title + "/";
		$http({
          method: 'PUT', 
	      url: uri,
          data: '',
          headers: {
            'Content-Type': 'text/turtle',
			'Link': '<http://www.w3.org/ns/ldp#BasicContainer>; rel="type"'
          },
          withCredentials: true
        }).
        success(function(data, status, headers) {
          if (status == 200 || status == 201) {
        	  //notify('Success', 'scheduler container has been created under ' + container);
        	  $scope.insertEvent(event, action);
          }
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create new directory.');
          } else if (status == 403) {
            notify('Forbiddenn', 'You are not allowed to create new directory.');
          } else {
            notify('Failed: '+ status + data);
          }
        });
    };
        
    // Insert or update an event resource
    $scope.insertEvent = function (event, operation) {
	    var uri = $scope.userProfile.schedulerStorage + event.title + "/"+ $scope.prefix + event.id;
        var resource = $scope.eventTemplate(event, uri);
        $http({
          method: 'PUT', 
          url: uri,
          data: resource,
          headers: {
            'Content-Type': 'text/turtle',
            'Link': '<http://www.w3.org/ns/ldp#Resource>; rel="type"'
          },
          withCredentials: true
        }).
        success(function(data, status, headers) {
          if (status == 200 || status == 201) {
            if(operation == CREATE){
            	notify('Success', 'Resource created.');
            	//update view
          	  	$scope.closeEditor();
            	$scope.events.push(event);
            	$scope.select($scope.events.indexOf(event), event);
            	$scope.sendInvitations(event);
            }
            else {
            	notify('Success', 'Resource updated.');
    	    	$scope.replace(event);
          	}
          }
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create new resource.');
          } else if (status == 403) {
            notify('Forbidden', 'You are not allowed to create new resource.');
          } else {
            notify('Failed '+ status + data);
          }
        });
    };
    
    // Insert or update a guest event resource
    $scope.insertGuestEvent = function (event, invitation) {
	    event.id = new Date().getTime();
    	var uri = $scope.userProfile.schedulerStorage + event.title + "_" + event.id + "/"+ $scope.prefix + event.id;
        var resource = $scope.guestEventTemplate(event, uri);
        $http({
          method: 'PUT', 
          url: uri,
          data: resource,
          headers: {
            'Content-Type': 'text/turtle',
            'Link': '<http://www.w3.org/ns/ldp#Resource>; rel="type"'
          },
          withCredentials: true
        }).
        success(function(data, status, headers) {
          if (status == 200 || status == 201) {
        	notify('Success', 'Resource created.');
        	//update view
        	$scope.events.push(event);
        	$scope.select($scope.events.indexOf(event), event);
        	$scope.removeInvitation(invitation);
          }
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create new resource.');
          } else if (status == 403) {
            notify('Forbidden', 'You are not allowed to create new resource.');
          } else {
            notify('Failed '+ status + data);
          }
        });
    };
    
    // Loops through event partecipants
    $scope.sendInvitations = function (event) {
    	for (var i in event.partecipants) {
    		if(!angular.equals($scope.userProfile.webid, event.partecipants[i])) {
    			var uri ="";
    	    	var temp = event.partecipants[i].split("/");
    	    	for(var i=0; i<temp.length-2; i++) {
    	    		uri += temp[i] + "/";
    	    	}
    	    	uri += "Inbox/";
    			$scope.send(uri, event);
    		}
    	}
    };
    
    // Insert an event invitation resource in partecipants inbox
    $scope.send = function (uri, event) {
    	var resource = $scope.eventInvitationTemplate(uri, event);
	    $http({
          method: 'POST', 
          url: uri,
          data: resource,
          headers: {
            'Content-Type': 'text/turtle',
            'Link': '<http://www.w3.org/ns/ldp#Resource>; rel="type"'
          },
          withCredentials: true
        }).
        success(function(data, status, headers) {
          if (status == 200 || status == 201) {
            $scope.createResponses(event);
          }
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create new resource.');
          } else if (status == 403) {
            notify('Forbidden', 'You are not allowed to create new resource.');
          } else {
            notify('Failed '+ status + data);
          }
        });
    };
    
    // Loops through event partecipants to create a response for each
    $scope.createResponses = function (event) {
    	for (var i in event.partecipants) {
    			$scope.insertResponse(i, event, CREATE);
    	}
    };
    
    // Insert a response resource in the same container of the origin event
    $scope.insertResponse = function (response, event, OPERATION) {
    	var uri = event.origin_url + $scope.prefixResponse + response.id;
    	var resource = $scope.eventResponseTemplate(response, event, OPERATION);
	    $http({
          method: 'PUT', 
          url: uri,
          data: resource,
          headers: {
            'Content-Type': 'text/turtle',
            'Link': '<http://www.w3.org/ns/ldp#Resource>; rel="type"'
          },
          withCredentials: true
        }).
        success(function(data, status, headers) {
          if (status == 200 || status == 201) {
        	  notify('Success', 'Response updated.');
          }
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create new resource.');
          } else if (status == 403) {
            notify('Forbidden', 'You are not allowed to create new resource.');
          } else {
            notify('Failed '+ status + data);
          }
        });
    };
    
    // Iterate through events list and delete event
    $scope.remove = function (index) {
    	var event = $scope.events[index];
        var uri = $scope.userProfile.calendarStorage + $scope.prefix + event.id;
    	$http({
    	      method: 'DELETE',
    	      url: uri,
    	      withCredentials: true
    	    }).
    	    success(function(data, status, headers) {
    	      if (status == 200) {
    	    	notify('Success', 'Resource deleted.');
    	        //update view
   	    		$scope.events.splice(index, 1);
    	      }
    	    }).
    	    error(function(data, status) {
    	      if (status == 401) {
    	    	  notify('Forbidden', 'Authentication required to delete '+uri);
    	      } else if (status == 403) {
    	    	  notify('Forbidden', 'You are not allowed to delete '+uri);
    	      } else if (status == 409) {
    	    	  notify('Failed', 'Conflict detected. In case of directory, check if not empty.');
    	      } else {
    	    	  notify('Failed '+status, data);
    	      }
    	});
    };
    
    // Iterate through invitations list and delete invitation
    $scope.removeInvitation = function (invitation) {
    	var index = 0;
    	for(i in $scope.invitations) {
    		if($scope.invitations[i].id == invitation.id)
    			index = i;
    	}
    	
        var uri = invitation.id;
    	$http({
    	      method: 'DELETE',
    	      url: uri,
    	      withCredentials: true
    	    }).
    	    success(function(data, status, headers) {
    	      if (status == 200) {
    	    	notify('Success', 'Resource deleted.');
    	        //update view
   	    		$scope.invitations.splice(index, 1);
    	      }
    	    }).
    	    error(function(data, status) {
    	      if (status == 401) {
    	    	  notify('Forbidden', 'Authentication required to delete '+uri);
    	      } else if (status == 403) {
    	    	  notify('Forbidden', 'You are not allowed to delete '+uri);
    	      } else if (status == 409) {
    	    	  notify('Failed', 'Conflict detected. In case of directory, check if not empty.');
    	      } else {
    	    	  notify('Failed '+status, data);
    	      }
    	});
    };
    
    // Checks if a container exists
    $scope.isContainerExisting = function (mystorage) {
    	var uri = mystorage.workspace + mystorage.storagename + "/";
    	$http({
          method: 'HEAD',
          url: uri,
          withCredentials: true
        }).
        success(function(data, status, headers) {
        	//container found, warn user to create a different one
        	$scope.noteTitle = "Warning: name already existing in the selected workspace!";
    		$scope.$digest();
        }).
        error(function(data, status) {
          if (status == 401) {
            notify('Forbidden', 'Authentication required to create a directory for: '+$scope.user);
          } else if (status == 403) {
        	  notify('Forbidden', 'You are not allowed to access storage for: '+$scope.user);
          } else if (status == 404) {
        	  //container not existing, proceed
        	  $scope.newStorage(mystorage);
          } else {
        	  notify('Failed - HTTP '+status, data, 5000);
          }
        });
    };
    
    // Composes an event as RDF resource
    $scope.eventTemplate = function (event, uri) {	// YYYY-MM-ddTHH:mm:ss.000Z
     	var sAttendee = "";
    	for(i in event.partecipants) {
    		sAttendee += "<" + event.partecipants[i] + ">";
    		if(i != event.partecipants.length-1)
    			sAttendee += ", ";
    	}
    	
    	var sProposed = "";
    	for(j in event.proposed) {
    		var sDate = buildDate(event.proposed[j]);
    		sProposed += "\"" + sDate + "\"^^<http://www.w3.org/2001/XMLSchema#dateTime>";
    		if(j != event.proposed.length-1)
    			sProposed += ", ";
    	}
    	
    	var rdf =   "<" + uri + ">\n" +
    				"a <http://www.w3.org/2000/01/rdf-schema#Resource>, <https://meccano.io/scheduler#schedulerEvent> ;\n" +
    				"<https://meccano.io/scheduler#title> \"" + event.title + "\" ;\n" +
    				"<https://meccano.io/scheduler#description> \"" + event.description + "\" ;\n" +
    				"<https://meccano.io/scheduler#origin_url> <" + event.origin_url + "> ;\n" +
					"<https://meccano.io/scheduler#organizer> <" + event.organizer + "> ;\n" +
					"<https://meccano.io/scheduler#proposed> " + sProposed + " ;\n" +
    				"<https://meccano.io/scheduler#attendee> " + sAttendee + " .\n" ;
    	return rdf;
    };
    
    // Composes a guest event as RDF resource
    $scope.guestEventTemplate = function (event, uri) {	// YYYY-MM-ddTHH:mm:ss.000Z
     	var sAttendee = "";
    	for(i in event.partecipants) {
    		sAttendee += "<" + event.partecipants[i] + ">";
    		if(i != event.partecipants.length-1)
    			sAttendee += ", ";
    	}
    	
    	var sProposed = "";
    	for(j in event.proposed) {
    		var sDate = buildDate(event.proposed[j]);
    		sProposed += "\"" + sDate + "\"^^<http://www.w3.org/2001/XMLSchema#dateTime>";
    		if(j != event.proposed.length-1)
    			sProposed += ", ";
    	}
    	
    	var rdf =   "<" + uri + ">\n" +
    				"a <http://www.w3.org/2000/01/rdf-schema#Resource>, <https://meccano.io/scheduler#schedulerEvent> ;\n" +
    				"<https://meccano.io/scheduler#title> \"" + event.title + "\" ;\n" +
    				"<https://meccano.io/scheduler#description> \"" + event.description + "\" ;\n" +
    				"<https://meccano.io/scheduler#origin_url> <" + event.origin_url + "> ;\n" +
					"<https://meccano.io/scheduler#organizer> <" + event.organizer + "> ;\n" +
					"<https://meccano.io/scheduler#proposed> " + sProposed + " ;\n" +
    				"<https://meccano.io/scheduler#attendee> " + sAttendee + " .\n" ;
    	return rdf;
    };
    
    // Composes an event invitation as RDF resource
    $scope.eventInvitationTemplate = function (uri, event) {    	
    	var rdf =   "<" + "" + ">\n" +
    				"a <http://www.w3.org/2000/01/rdf-schema#Resource>, <https://meccano.io/scheduler#schedulerInvitation> ;\n" +
    				"<https://meccano.io/scheduler#origin_url> <" + event.origin_url + "> ;\n" +
    				"<https://meccano.io/scheduler#title> \"" + event.title + "\" ;\n" +
    				"<https://meccano.io/scheduler#description> \"" + event.description + "\" ;\n" +
					"<https://meccano.io/scheduler#organizer> <" + event.organizer + "> .\n";
		return rdf;
    };
    
    // Composes an event response as RDF resource
    $scope.eventResponseTemplate = function (response, event, OPERATION) {    	
    	var rdf =   "<" + "" + ">\n" +
    				"a <http://www.w3.org/2000/01/rdf-schema#Resource>, <https://meccano.io/scheduler#schedulerResponse> ;\n";
    		
    	if(OPERATION == CREATE) { 
    		rdf += "<https://meccano.io/scheduler#partecipant> <" + response.partecipant + "> .\n" ;
    	}
    	
    	if(OPERATION == UPDATE) {  		
    		if(response.confirmed.length != 0){
	    		var sConfirmed = "";
	        	for(j in response.confirmed) {
	        		var sDate = buildDateFromTime(response.confirmed[j]);
	        		sConfirmed += "\"" + sDate + "\"^^<http://www.w3.org/2001/XMLSchema#dateTime>";
	        		if(j != response.confirmed.length-1)
	        			sConfirmed += ", ";
	        	}
	        	
	        	rdf += "<https://meccano.io/scheduler#confirmed> " + sConfirmed + " ;\n";
    		}
    		
    		rdf += "<https://meccano.io/scheduler#partecipant> <" + response.partecipant + "> .\n";
				   
    	}
		return rdf;
    };
    
    // Composes the app metadata as RDF resource
    $scope.metadataTemplate = function (uri, container) {  	
    	var rdf = "";
		var sTypes = "";
	    if($scope.apptypes.length > 0) {
    		for(i in $scope.apptypes) {
    			sTypes += "<" + $scope.apptypes[i] + ">";
    			if(i != $scope.apptypes.length-1)
    				sTypes += ", ";	    				
     		}
    	}
	    
	    var aWorkspace = container.split("/");
	    var sWorkspace = "";
		for(var j=0; j<aWorkspace.length-2; j++){
			sWorkspace += aWorkspace[j] + "/";
		}
	    
	    rdf = "<" + uri + ">\n" +
 		 "a <https://example.com/application> ;\n" +
 		 "<http://purl.org/dc/elements/1.1/title> \"Scheduler\" ;\n" +
 		 "<https://example.com/app-url> <" + $scope.appurl + "> ;\n" + 
 		 "<https://example.com/logo> <" + $scope.appurl + "images/scheduler.gif" + "> ;\n" +
 		 "<http://www.w3.org/ns/pim/space#workspace> <" + sWorkspace + "> ;\n" +
 		 "<http://www.w3.org/ns/pim/space#storage> <" + container + "> ;\n" +
 		 "<https://example.com/types> " + sTypes + " ." ;	    
		         
    	return rdf;
    };
    
    //Builds a customized timestamp date from date
    function buildDate(date){
    	var year = date.getUTCFullYear();
    	var month = date.getUTCMonth()+1;
    	var day = date.getUTCDate();
    	var hours = date.getHours();
    	var minutes = "0";
    	var seconds = "0";
    	
    	if(month < 10){
    		month = "0" + month;
    	}
    	
    	if(day < 10){
    		day = "0" + day;
    	}
    	
    	if(hours < 10){
    		hours = "0" + hours;
    	}
    	
    	if(minutes < 10){
    		minutes = "0" + minutes;
    	}
    	
    	if(seconds < 10){
    		seconds = "0" + seconds;
    	}
    		
    	var resultString = year + "-" + month + "-" + day + "T" + hours + ":" + minutes + ":" + seconds + ".000Z";
    	return resultString;
    }
    
    //Builds a customized timestamp date from regular timestamp
    function buildDateFromTime(time){
    	var date = new Date(time);
    	var year = date.getUTCFullYear();
    	var month = date.getUTCMonth()+1;
    	var day = date.getUTCDate();
    	var hours = date.getHours();
    	var minutes = "0";
    	var seconds = "0";
    	
    	if(month < 10){
    		month = "0" + month;
    	}
    	
    	if(day < 10){
    		day = "0" + day;
    	}
    	
    	if(hours < 10){
    		hours = "0" + hours;
    	}
    	
    	if(minutes < 10){
    		minutes = "0" + minutes;
    	}
    	
    	if(seconds < 10){
    		seconds = "0" + seconds;
    	}
    		
    	var resultString = year + "-" + month + "-" + day + "T" + hours + ":" + minutes + ":" + seconds + ".000Z";
    	return resultString;
    }
                
    // Listen to WebIDAuth events
    var eventMethod = window.addEventListener ? "addEventListener" : "attachEvent";
    var eventListener = window[eventMethod];
    var messageEvent = eventMethod == "attachEvent" ? "onmessage" : "message";
    eventListener(messageEvent,function(e) {
        if (e.data.slice(0,5) == 'User:') {          
            $scope.authenticate(e.data.slice(5, e.data.length));
            $scope.userProfile.webid = e.data.slice(5);
            //get user properties
            $scope.getUserInfo();
        }
        
        $scope.closeAuth();
    },false);
    
    // Retrieve from sessionStorage
    if (sessionStorage.getItem($scope.appuri)) {
        var app = JSON.parse(sessionStorage.getItem($scope.appuri));
        if (app.userProfile) {
          //if (!$scope.userProfile) {
          //  $scope.userProfile = {};
          //}
          $scope.userProfile = app.userProfile;
          $scope.getWorkspaces($scope.userProfile.preferencesFile);
          $scope.loggedin = true;
        } else {
          // clear sessionStorage in case there was a change to the data structure
          sessionStorage.removeItem($scope.appuri);
        }
    }
});
/* EOF */
