var user = {};
user.loadingTrello = true;
user.creatingExport = false;
user.onlyMe = false;
//user.commentMatch = /^\(\+?(\d+)(?:\s+(0?[1-9]|[1-2][0-9]|3[01])\/(0?[1-9]|1[0-2])\/((?:19|20)?\d{2}))?\)/;
user.dateRe = '(0?[1-9]|[1-2]\\d|3[01])\\/(0?[1-9]|1[0-2])\\/((?:19|20)?\\d{2})';
user.commentMatch = new RegExp('^\\(\\+?(\\d+)(?:\\)\\s+(?:\\['+user.dateRe+'\\]|\\('+user.dateRe+'\\))|\\s+'+user.dateRe+'\\)|\\))');

var app = {
    initialize: function() {
        app.Log("Authenticating with Trello");
        app.UpdateButton("btnExport", true, 'btnRed');
        $(".datepicker").datepicker({ dateFormat: "dd/mm/yy" }).attr('readonly','readonly');
        app.UpdateButton("btnOptions", true, 'btnGreen');
        $(document).ajaxStop(function () {
            $("#status").html("<b>Status: </b> Data Loading Complete");
            if (user.loadingTrello === true){
                user.loadingTrello = false;
                app.optionsEntered();
            }

            if (user.creatingExport === true){
                $("#status").html("<b>Status: </b> Generating View");
                app.generateView();
                user.creatingExport = false;
                $("#status").html("<b>Status: </b> View Finished Loading");
            }
        });
        $("#status").html("<b>Status: </b> Authenticating with Trello");
        app.AuthenticateTrello();
    },
    optionsEntered: function(sender) {
        var enabled = false,
            startDate = $("#startDate"),
            endDate = $("#endDate"),
            dDate,
            sDate,
            temp,
            dEndDate = null,
            dStartDate = null;

        if (startDate.val() !== ""){
            dDate = startDate.val().split("/");
            dStartDate = new Date(dDate[2], dDate[1]-1, dDate[0]);
        }
        if (endDate.val() !== ""){
            dDate = endDate.val().split("/");
            dEndDate = new Date(dDate[2], dDate[1]-1, dDate[0]);
        }
        if ((dStartDate !== null) && (dEndDate === null)){
            //dDate = new Date(dDate[2], dDate[1]-1, dDate[0]);
            //dDate = dStartDate
            dDate = new Date(dStartDate.getTime());
            dDate.setDate(dDate.getDate() + 7);
            sDate = dDate.getDate() < 10 ? "0" + dDate.getDate() : dDate.getDate();
            temp = dDate.getMonth()+1;
            sDate += "/";
            sDate += temp < 10 ? "0" + temp : temp;
            sDate += "/" + dDate.getFullYear();
            $("#endDate").val(sDate);
        }
        if (endDate.val() !== ""){
            dDate = endDate.val().split("/");
            dEndDate = new Date(dDate[2], dDate[1]-1, dDate[0]);
        }

        enabled = ((user.loadingTrello === false) && (startDate.val() !== "") && (endDate.val() !== "") &&
                     (dStartDate !== null) && (dEndDate !== null) && (dStartDate <= dEndDate));
        app.UpdateButton("btnOptions", !enabled, 'btnGreen');
        user.startDate = dStartDate;
        user.endDate = dEndDate;
        user.dateRange = null;
        if ((dStartDate !== null) && (dEndDate !== null)) {
            $("#daterange").html("");
            sDate = dStartDate.getDate() < 10 ? "0" + dStartDate.getDate() : dStartDate.getDate();
            temp = dStartDate.getMonth()+1;
            sDate += "/";
            sDate += temp < 10 ? "0" + temp : temp;
            sDate += "/" + dStartDate.getFullYear();

            sDate += " - ";

            sDate += dEndDate.getDate() < 10 ? "0" + dEndDate.getDate() : dEndDate.getDate();
            temp = dEndDate.getMonth()+1;
            sDate += "/";
            sDate += temp < 10 ? "0" + temp : temp;
            sDate += "/" + dEndDate.getFullYear();
            user.dateRange = sDate;
            $("#daterange").html("Date range: " + sDate);
        }

    },
    AuthenticateTrello: function() {
        var authOpts = [];
        authOpts["type"] = "redirect";
        authOpts["name"] = "Time Export";
        authOpts["persist"] = "true";
        authOpts["interactive"] = "true";
        authOpts["scope"] = {read:"allowRead", write:"allowWrite", account:"allowAccount"};
        authOpts["expiration"] = "never";
        authOpts["success"] = app.AuthSuccess;
        authOpts["error"] = function(){ app.Failed("Denied Access"); };
        app.Log("Calling Trello Auth");
        Trello.authorize(authOpts);
    },
    AuthSuccess: function() {
        app.Log("Authenticated");
        app.Log("Getting User Data");
        $("#status").html("<b>Status: </b> Getting User Data");
        $( ".tabs" ).tabs();
        $( "#tabs" ).tabs( "disable" );
        $('#assignedToMe').on('change', function(){
            user.onlyMe = ($(this).is(':checked'));
        });
        app.GerUserData();
    },
    Failed: function(msg) {
        app.Log("Failure Occured: " + msg);
    },
    CheckforParams: function(){
        
    },
    GerUserData: function() {
        $( "#tabs" ).tabs( "enable" );
        $( "#tabs" ).tabs( "option", "disabled", [ 1, 2, 3 ] );
        app.CheckforParams();

        Trello.rest("GET", "members/me", {},
            function(data){
                user.id = data.id;
                user.username = data.username;
                user.fullname = data.fullName;
                user.email = data.email;
                user.url = data.url;
                user.status = data.status;
                user.avatar = data.avatarHash;
                user.boards = {};
                $("#status").html("<b>Status: </b> Fetching Board Information");
                $.each(data.idBoards, function (index, value){
                    app.GetBoardInformation(index, value);
                });
            },
            function(){ app.Failed("Couldn't return 'Me'"); });
    },
    GetBoardInformation: function(index, boardid){
        app.UpdateFromBoard();
        if (boardid){
            Trello.rest("GET", "board/" + boardid, {},
                function(data){
                    if (data.idOrganization){
                        user.boards[boardid] = {};
                        user.boards[boardid].id = boardid;
                        user.boards[boardid].color = app.changeColour(index, data);
                        user.boards[boardid].textColor = app.getTextColor(user.boards[boardid].color);
                        user.boards[boardid].name = data.name;
                        user.boards[boardid].url = data.shortUrl;
                        user.boards[boardid].labels = {};
                        $.each(data.labelNames, function(index, value){
                            user.boards[boardid].labels[index] = value;
                        });
                        $("#BoardsCheckboxes").prepend('<input type="checkbox" id="cb' + boardid + '" value="' + boardid + '" onclick="app.UpdateFromBoard(\'' + boardid + '\')" > ' + data.name +"<br />");
                        app.GetBoardLists(user.boards[boardid]);
                    }
                },
                function(){
                    app.Failed("Couldn't get board " + boardid);
                }
            );
        }
    },
    GetBoardLists: function (board){
        if (board.id){
            Trello.rest("GET", "board/" + board.id + "/lists/all", {},
                function(data){
                    board.lists = {};
                    $.each(data, function(index, value){
                        board.lists[value.id] = {};
                        board.lists[value.id] = value;
                        board.lists[value.id].cards = {};
                    });
                },
                function(){
                    app.Failed("Couldn't get board " + board.id);
                }
            );
        }
    },
    UpdateFromBoard: function(boardid){
        $("#ListsCheckboxes").empty();
        var boards = $("#BoardsCheckboxes input[type=checkbox]");
        app.UpdateButton("btnBoard", true, 'btnGreen');
        app.UpdateButton("btnList", true, 'btnGreen');
        app.UpdateButton("btnRun", true, 'btnGreen');
        var canProgress = false;
        var allSelected = true;
        var counter = 0;
        $.each(boards, function(index, cb){
            counter++;
            if (cb.checked === true){
                canProgress = true;
                if ((user.boards[cb.value]) && (user.boards[cb.value].lists)) {
                    $.each(user.boards[cb.value].lists, function (index, value){
                        $("#ListsCheckboxes").prepend('<input type="checkbox" id="cb' + user.boards[cb.value].lists[index].id +
                                '" value="' + user.boards[cb.value].lists[index].id +
                                '" onclick="app.UpdateFromList(\'' + index + '\')" > ' +
                                user.boards[cb.value].name + " - " + user.boards[cb.value].lists[index].name +"<br />");
                    });
                }
            } else {
                allSelected = false;
            }
        });
        app.UpdateButton("btnBoard", !canProgress, 'btnGreen');
        app.updateAllSelected("selectAllBoards", allSelected, counter);
    },
    UpdateFromList: function(listid){
        var lists = $("#ListsCheckboxes input[type=checkbox]");
        app.UpdateButton("btnList", true, 'btnGreen');
        app.UpdateButton("btnRun", true, 'btnGreen');
        var canProgress = false;
        var allSelected = true;
        var counter = 0;
        $.each(lists, function(index, cb){
            counter++;
            if (cb.checked === true){
                canProgress = true;
            } else {
                allSelected = false;
            }
        });
        app.UpdateButton("btnList", !canProgress, 'btnGreen');
        app.UpdateButton("btnRun", !canProgress, 'btnGreen');
        app.updateAllSelected("selectAllLists", allSelected, counter);
    },
    MoveTab: function (activateIndex, disableIndexs){
        $("#colorLegend").empty();
        $("#colors").hide("fast");
        $("#calendar").empty();
        $("#tabs").tabs("enable", activateIndex );
        $("#tabs").tabs("option", "active", activateIndex);
        $("#tabs").tabs("option", "disabled", disableIndexs );

        $("#tabs").tabs("option", "active", activateIndex);
    },
    UpdateButton: function(elementId, disabled, className){
        if (disabled === true){
            $("#" + elementId).attr('disabled','disabled');
            $("#" + elementId).removeClass(className);
        } else {
            $("#" + elementId).removeAttr('disabled');
            $("#" + elementId).addClass(className);
        }
    },
    selectAllBoards: function() {
        var cbSelect = $("#selectAllBoards")[0];
        var selectedValue = cbSelect.checked;
        var boards = $("#BoardsCheckboxes input[type=checkbox]");
        $.each(boards, function(index, cb){
            cb.checked = selectedValue;
        });
        app.UpdateFromBoard();
    },
    selectAllLists: function() {
        var cbSelect = $("#selectAllLists")[0];
        var selectedValue = cbSelect.checked;
        var lists = $("#ListsCheckboxes input[type=checkbox]");
        $.each(lists, function(index, cb){
            cb.checked = selectedValue;
        });
        app.UpdateFromList();
    },
    updateAllSelected: function (selector, checkedValue, counter){
        $("#" + selector)[0].checked = ((checkedValue === true) && (counter > 0));
    },
    convertDateTime: function(dateStr){
        var dateObj = new Date(dateStr);
        dateObj.setMonth(dateObj.getMonth() + 1);
        return dateObj;
    },
    Log: function(msg) {
        console.log(msg);
    },
    changeColour: function(count, board){
        if (board.prefs.backgroundColor != "#205C7E") {
            RGB = app.HextoRGB(board.prefs.backgroundColor);
            return app.RGB(RGB.r, RGB.g, RGB.b);
        } else {
            var freqr = 1.666 * count;
            var freqg = 2.666 * count;
            var freqb = 3.666 * count;
            return app.makeColorGradient(freqr, freqg, freqb, 0, 0, 0, 128, 127);
        }
    },
    getTextColor: function(backgroundColor){
        var rgb = backgroundColor.replace(/^rgba?\(|\s+|\)$/g,'').split(',');
        return app.idealTextColor(rgb[0], rgb[1], rgb[2]);
    },
    RGB: function (r,g,b)
    {
        return 'rgb(' + Math.floor(r) + ',' + Math.floor(g) + ',' + Math.floor(b) + ')';
    },
    makeColorGradient: function (frequency1, frequency2, frequency3, phase1, phase2, phase3, center, width, len)
    {
        if (len === undefined)      len = 50;
        if (center === undefined)   center = 128;
        if (width === undefined)    width = 127;

        var red = Math.sin(frequency1 + phase1) * width + center;
        var grn = Math.sin(frequency2 + phase2) * width + center;
        var blu = Math.sin(frequency3 + phase3) * width + center;
        return app.RGB(red,grn,blu);
    },
    idealTextColor: function(r,g,b) {
        //var nThreshold = 105;
        var nThreshold = 105;
        var components = app.getRGBComponents(r,g,b);
        var bgDelta = (components.R * 0.299) + (components.G * 0.587) + (components.B * 0.114);
        var val = 255 - bgDelta;
        return (val < nThreshold) ? "rgb(0,0,0)" : "rgb(255,255,255)";
        //return ((val > 65 || val <50) && (val < 105)) ? "rgb(0,0,0)" : "rgb(255,255,255)" ;   
    },
    getRGBComponents: function(r,g,b) {
        return {
           R: r,
           G: g,
           B: b
        };
    },
    HextoRGB: function (hex) {
        var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    },
    openLink: function (url){
        window.open(url);
    },
    run: function() {
        $("#times").fadeOut("fast");
        app.CheckforParams();
        user.creatingExport = true;
        app.UpdateButton("btnRun", true, 'btnGreen');
        app.UpdateButton("btnRunPrev", true, 'btnBlue');
        app.UpdateButton("btnExport", true, 'btnRed');
        $("#status").html("<b>Status: </b> Fetching Trello Data");
        var lists = $("#ListsCheckboxes input[type=checkbox]");
        $.each(lists, function(index, cb){
            if (cb.checked === true){
                Trello.rest("GET", "lists/" + cb.value + "/cards", {},
                    function(data){
                        $.each(data, function(index, card){
                            user.boards[card.idBoard].lists[card.idList].cards[card.id] = card;
                            user.boards[card.idBoard].lists[card.idList].cards[card.id].comments = {};
                            app.getComments(user.boards[card.idBoard].lists[card.idList].cards[card.id], card.id);
                        });
                    },
                    function(){
                        app.Failed("Couldn't cards from list " + cb.value);
                    }
                );
            }
        });
    },
    getComments: function(objCard, cardid){
        Trello.rest("GET", "cards/" + cardid + "/actions", {},
            function(data){
                $.each(data, function(index, action){
                    if (action.type.toUpperCase() == "COMMENTCARD"){
                        objCard.comments[action.id] = {};
                        objCard.comments[action.id] = action;
                        app.addMember(action);
                        app.getCommentText(objCard, action.id);
                    }
                });
            },
            function(){
                app.Failed("Couldn't comments from card " + cardid);
            }
        );
    },
    addMember: function (commentData){
        if (typeof user.members == "undefined"){
            user.members = {};
        }
        if (typeof user.members[commentData.idMemberCreator] == "undefined"){
            user.members[commentData.idMemberCreator] = {};
        }
        user.members[commentData.idMemberCreator] = commentData.memberCreator;
    },
    getCommentText: function (objCard, commentId){
        Trello.rest("GET", "actions/" + commentId, {},
            function(data){
                objCard.comments[commentId].commentText = data.data.text;
            },
            function(){
                app.Failed("Couldn't comment text from comment id " + cardid);
            }
        );
    },
    generateView: function(){
        app.Log("Loading View");
        var commentList = [];
        var curBoard,
            curList,
            curCard;
        $.each(user.boards, function(index, board){
            curBoard = user.boards[index];
            curBoard.totalTime = 0;
            $.each(board.lists, function(index, list){
                curList = curBoard.lists[index];
                curList.totalTime = 0;
                $.each(list.cards, function(index, card){
                    curCard = curList.cards[index];
                    curCard.totalTime = 0;
                    $.each(card.comments, function(index, comment){
                        var com = curCard.comments[comment.id];
                        com.show = false;
                        var matches = user.commentMatch.exec(comment.commentText);
                        if ((matches) && (matches[1] !== undefined)) {
                            var temp = comment.date.split("-");
                            var dateVal = temp[2].split("T")[0];
                            var commentDate = new Date();
                            commentDate.setFullYear(temp[0], temp[1]-1, dateVal);
                            if ((matches.length >= 11) && ((matches[4] !== undefined) || (matches[7] !== undefined) || (matches[10] !== undefined))) {
                                //date is in the comment
                                commentDate = app.getCommentDate(matches);
                            }
                            //if ((commentDate >= user.startDate) && (commentDate <= user.endDate)){
                            if (app.checkDates(commentDate, com.id) === true) {
                                if (((user.onlyMe === true) && (user.id == comment.idMemberCreator)) || (user.onlyMe === false)){
                                    com.time = matches[1];
                                    com.actualDate = commentDate;
                                    com.show = true;
                                    curCard.totalTime = curCard.totalTime + parseInt(com.time, 10);
                                    curList.totalTime = curList.totalTime + parseInt(com.time, 10);
                                    curBoard.totalTime = curBoard.totalTime + parseInt(com.time, 10);
                                }
                            }
                        }
                    });
                });
            });
        });
        app.displayTimes();
    },
    checkDates: function (commentDate, id){
        // Have to strip the time section off the comment date before comparing against the start/end date
        // comment date = date time
        // start/end = date
        //
        // Comment = 26/11/2013 16:36:10
        // Start = 1/11/2013 (00:00:00)
        // End = 26/11/2013 (00:00:00)
        //
        // Shows if
        // ((commentDate >= startDate) && (commentDate <= endDate)) 
        //
        // Comment wouldn't show
        if (typeof commentDate != "undefined"){
            var c = new Date(commentDate.getFullYear(), commentDate.getMonth(), commentDate.getDate()).setHours(0,0,0,0);
            return ((c >= user.startDate) && (c <= user.endDate));
        }
        return false;
        
    },
    getCommentDate: function(m){
        var date;
        if (m[4] !== undefined){
            date = new Date();
            date.setFullYear(m[4], m[3]-1, m[2]);
        } else if (m[7] !== undefined) {
            date = new Date();
            date.setFullYear(m[7], m[6]-1, m[5]);
        } else if (m[10] !== undefined) {
            date = new Date();
            date.setFullYear(m[10], m[9]-1, m[8]);
        } else {
            date = undefined; //shouldn't get here!
        }
        return date;
    },
    displayTimes: function(){
        var table = "<table id='timesTable' border='1px' cellpadding='5px;'>";
        //table += app.tableRow("<th>Board</th><th>List</th><th>Card</th><th>Comment Date</th><th>Comment Time</th><th>Comment Text</th>")
            
        var curBoard,
            curList,
            curCard;
        $.each(user.boards, function(index, board){
            curBoard = user.boards[index];
            if (curBoard.totalTime !== 0){
                table += app.tableRow("<th colspan=\"4\" class=\"board\">" +
                                      "<a href='" + curBoard.url + "'>" + curBoard.name + "</a>" +
                                      "</th><th class=\"timeTotal boardTime\">" + curBoard.totalTime + "</th>");
                $.each(board.lists, function(index, list){
                    curList = curBoard.lists[index];
                    if (curList.totalTime !== 0){
                        table += app.tableRow(app.tableCell("List:" + curList.name, "list", 4) + app.tableCell(curList.totalTime, "timeTotal listTime"));
                        $.each(list.cards, function(index, card){
                            curCard = curList.cards[index];
                            if (curCard.totalTime !== 0){
                                table += app.tableRow(app.tableCell("<a href='" + curCard.shortUrl + "'>" + curCard.name + "</a>", "card", 4) + app.tableCell(curCard.totalTime, "timeTotal cardTime"));
                                $.each(card.comments, function(index, comment){
                                    var com = curCard.comments[index];
                                    if (com.show === true){
                                         table += app.tableRow(
                                            app.tableCell(app.getMemberName(com.idMemberCreator), "commentName") +
                                            app.tableCell(app.formatDisplayDate(com.actualDate), "commentDate") +
                                            app.tableCell(com.commentText, "", 2) +
                                            app.tableCell(com.time, "commentTime")
                                        );
                                    }
                                });
                            }
                        });
                    }
                });
            }
        });
        $("#times").html(table);
        setTimeout(function(){
            $("#times").fadeIn("slow");
            app.UpdateButton("btnExport", false, 'btnRed');
            app.UpdateButton("btnRun", false, 'btnGreen');
            app.UpdateButton("btnRunPrev", false, 'btnBlue');
        }, 500);
    },
    tableCell: function (data, className, colspan){
        var cell = "<td";
        if (className && className !== ""){
            cell += " class=\"" + className + "\"";
        }
        if (colspan && colspan > 1){
            cell += " colspan=\"" + colspan + "\"";
        }
        cell += ">" + data + "</td>";
        return cell;
    },
    tableRow: function (data){
        return "<tr>" + data + "</tr>";
    },
    getMemberName: function(memberId){
        return user.members[memberId].fullName;
    },
    lpad: function(s, l, p) {
        s += "";
        if (typeof p != 'string')
            p += ' ';
        p = p.length > 0 ? p[0] : ' ';
        while (s.length<l) {
            s = p + s;
        }
        return s;
    },
    formatDisplayDate: function(commentDate){
        var d = new Date(commentDate);
        var dispDate = "";
        dispDate += this.lpad(d.getDate(), 2, '0'); //d.getDate() < 10 ? "0" + d.getDate() : d.getDate();
        dispDate += "/" + this.lpad(d.getMonth()+1, 2, '0'); // (d.getMonth()+1 < 10 ? "0" + d.getMonth()+1 : d.getMonth()+1);
        dispDate += "/" + d.getFullYear();
        return dispDate;
    },
    exportTable: function(){
        tableToExcel('timesTable', 'Trello Times', 'Trello Times (' + user.dateRange + ')');
    }
};

var tableToExcel = (function () {
        var uri = 'data:application/vnd.ms-excel;base64,',
            template = '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>{worksheet}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table>{table}</table></body></html>',
            base64 = function (s) { return window.btoa(unescape(encodeURIComponent(s))); },
            format = function (s, c) { return s.replace(/{(\w+)}/g, function (m, p) { return c[p]; }); };
        return function (table, name, filename) {
            if (!table.nodeType) table = document.getElementById(table);
            var ctx = { worksheet: name || 'Worksheet', table: table.innerHTML };

            document.getElementById("dlink").href = uri + base64(format(template, ctx));

            d = new Date();
            df = ""+d.getFullYear()+(d.getMonth()+1)+d.getDate()+d.getHours();
            if (d.getMinutes() < 10) {
                df = df + "0" + d.getMinutes();
            } else {
                df = df + d.getMinutes();
            }

            document.getElementById("dlink").download = filename + ".xls";//filename + "-" + df + ".xls";
            document.getElementById("dlink").click();

        };
    })();