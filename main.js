define(function (require, exports, module) {
    "use strict";
    var EditorManager = brackets.getModule('editor/EditorManager'),
        CommandManager = brackets.getModule("command/CommandManager"),
        Mustache = brackets.getModule("thirdparty/mustache/mustache"),
        Menus = brackets.getModule("command/Menus"),
        Dialogs = brackets.getModule("widgets/Dialogs"),
        ExtensionUtils = brackets.getModule("utils/ExtensionUtils"),
        AppInit = brackets.getModule("utils/AppInit"),
        editorContextMenu = Menus.getContextMenu(Menus.ContextMenuIds.EDITOR_MENU),
        editor;

    var attrName = "data-jzmstrjp-table-editor-selected";

    var SLDialog_tmp = require("text!dialog.html");
    var SLDialog;

    //最後に消す属性たち
    var removeAttr = ["data-jzmstrjp-table-editor-selected"];
    
    var table_wrap_id = "jzmstrjp_table_editor_dialog_wrap";

    var forEach = Array.prototype.forEach;
    var prevArr = [];
    var nextArr = [];

    var dialog;

    var dragMode;
    var cell1; //最初に触れたセル
    var leftEnd;
    var rightEnd;
    var topEnd;
    var bottomEnd;


    ExtensionUtils.loadStyleSheet(module, "main.less");

    CommandManager.register("Open Table Editor", "jzmstrjp.paste_and_table.open_table_editor", open_table_editor);

    function open_table_editor() {
        editor = EditorManager.getCurrentFullEditor();
        var selectTxt = editor.getSelectedText();
        if (/^\s*<table( |>)/i.test(selectTxt) && /<\/table>\s*?$/i.test(selectTxt)) {
            openDialog(selectTxt);
        } else {
            alert("Please select <table> ~ </table>");
        }
    }

    function openDialog(selectTxt) {
        var dl = Dialogs.showModalDialogUsingTemplate(Mustache.render(SLDialog_tmp));
        var editedTable;
        var table_wrap = document.createElement("div");
        //前のテーブルの履歴は消す！
        prevArr = [];
        nextArr = [];
        //table.setAttribute("contenteditable", "true");
        table_wrap.id = table_wrap_id;
        table_wrap.innerHTML = selectTxt;
        SLDialog = dl.getElement();
        dialog = document.getElementById("jzmstrjp_table_editor_dialog");
        dialog.parentNode.style.textAlign = "center";
        dialog.querySelector(".modal-body .modal-body-box").appendChild(table_wrap);
        tableEditSetting(dialog);

        editedTable = document.getElementById(table_wrap.id);
        SLDialog.on('click', '.dialog-button-save', function () {
            //不要な属性を消す。配列で指定可能。
            removeAttr.forEach(function (attr) {
                var elms = editedTable.querySelectorAll("[" + attr + "]");
                forEach.call(elms, function (elm) {
                    elm.removeAttribute(attr);
                });
            });

            replace(editedTable);
        });

        dialog.querySelector(".reset_btn").addEventListener("click", function () {
            var answer = confirm('Reset Table?');
            if(answer){
                prevArr = [];
                nextArr = [];
                tableReset(dialog, table_wrap, selectTxt);
            }
        });

    }

    function tableReset(dialog, table_wrap, selectTxt) {
        rireki_btns_disabled();
        table_wrap.innerHTML = selectTxt;
        dialog.querySelector(".modal-body .modal-body-box").innerHTML = "";
        dialog.querySelector(".modal-body .modal-body-box").appendChild(table_wrap);
        tableEditSetting(dialog, {byResetButton: true});//テーブルセット。でもリセットモード
    }



    function tableEditSetting(dialog, option) {
        var cells,
            table;

        table = dialog.querySelector("table");
        cells = dialog.querySelectorAll("#jzmstrjp_table_editor_dialog_wrap > table > * > tr > *"); //thとtd。（子テーブルは無視）

        addSelectedAttr(cells, table, option);

        //ダブルクリックでのテキスト編集機能を全セルに。
        forEach.call(cells, function (elm) {
            elm.addEventListener("dblclick", function(){
                var motoHTML = document.querySelector("#" + table_wrap_id).innerHTML;
                var changed = prompt("", this.innerHTML);
                if(changed && changed !== this.innerHTML){//同じ文字列でOKしたら履歴不要。
                    rireki_make(motoHTML);
                    this.innerHTML = changed;
                }else{
                    this.innerHTML = this.innerHTML;
                }
            });
        });

        if(!option || !option.byResetButton){//リセットモード時は、ボタンにイベント付けない（重複するので）
            dialog.querySelector(".merge_btn").addEventListener("click", function () {
                mergeCell(dialog.querySelector("table"));//変数：tableを使うと古いテーブルの情報のままになる
            });
            dialog.querySelector(".split_btn").addEventListener("click", function () {
                splitCell(dialog.querySelector("table"));//変数：tableを使うと古いテーブルの情報のままになる
            });

            dialog.querySelector(".th_btn").addEventListener("click", function () {
                to_th_or_td(dialog.querySelector("table"), "th");
            });
            dialog.querySelector(".td_btn").addEventListener("click", function () {
                to_th_or_td(dialog.querySelector("table"), "td");
            });
            
            dialog.querySelector(".prev_btn").addEventListener("click", function (e) {
                prev(e);
            });
            dialog.querySelector(".next_btn").addEventListener("click", function (e) {
                next(e);
            });

        }
    }

    function prev(e){
        if(e.target.disabled){
            return;
        }
        nextArr.push(document.querySelector("#" + table_wrap_id).innerHTML);
        document.querySelector("#" + table_wrap_id).innerHTML = prevArr.pop();
        addSelectedAttr(dialog.querySelectorAll("#jzmstrjp_table_editor_dialog_wrap > table > * > tr > *"), dialog.querySelector("table"));
        rireki_btns_disabled();
        //console.log("prev");
    }

    function next(e){
        if(e.target.disabled){
            return;
        }
        prevArr.push(document.querySelector("#" + table_wrap_id).innerHTML);
        document.querySelector("#" + table_wrap_id).innerHTML = nextArr.pop();
        addSelectedAttr(dialog.querySelectorAll("#jzmstrjp_table_editor_dialog_wrap > table > * > tr > *"), dialog.querySelector("table"));
        rireki_btns_disabled();
        //console.log("next");
    }

    function rireki_make(motoHTML){
        if(prevArr.length > 50){//履歴は50回まで
            prevArr.shift();
        }
        prevArr.push(motoHTML);
        nextArr = [];
        rireki_btns_disabled();
        //console.log(prevArr);
    }

    function rireki_btns_disabled(){
        if(prevArr.length > 0){
            dialog.querySelector(".prev_btn").disabled = false;
        }else{
            dialog.querySelector(".prev_btn").disabled =true;
        }

        if(nextArr.length > 0){
            dialog.querySelector(".next_btn").disabled = false;
        }else{
            dialog.querySelector(".next_btn").disabled =true;
        }
    }

    

    function splitCell(table){
        var motoHTML = document.querySelector("#" + table_wrap_id).innerHTML;
        var selected = table.querySelectorAll("[" + attrName + "]");
        var changed = false;
        
        forEach.call(selected, function(cell){
            split(cell);
        });
        function split(cell){
            var rows = cell.rowSpan;
            var cols = cell.colSpan;
            var clone;
            var cellPos;
            var map;
            cellPos = get_cell_pos(table, cell);
            map = get_cell_map(table);
            if(rows === 1 && cols === 1){
                //alert("分割する必要なし！");
                return;
            }
            changed = true;
            cell.removeAttribute("rowspan");
            cell.removeAttribute("colspan");

            //1行目
            for(var i = 0; i < cols - 1; i++){
                clone = cell.cloneNode();
                cell.parentNode.insertBefore(clone, cell.nextElementSibling);
            }
            
            //2行目以降
            //nowTable = document.querySelector("#jzmstrjp_table_editor_dialog_wrap > table");
            for(i = 0; i < rows - 1; i++){
                var nextRowIndex = cell.parentNode.rowIndex + i + 1;
                var nextColIndex = cellPos.x + cols;
                //console.log(nextRowIndex);
                var nextCol = map[nextRowIndex][nextColIndex];
                //console.log(nextCol);
                //console.log(nextCol.parentNode.rowIndex);

                for(var j = 0; j < cols; j++){
                    clone = cell.cloneNode();
                    while(nextCol && nextRowIndex !== nextCol.parentNode.rowIndex){//次のエレメントが(あって)本物じゃない間はその次に行って、本物を探す。
                        nextColIndex++;
                        nextCol = map[nextRowIndex][nextColIndex];
                        //console.log(nextCol);
                    }
                    if(nextCol){//本物の次のセルが見つかったなら
                        table.rows[nextRowIndex].insertBefore(clone, nextCol);
                    }else{
                        table.rows[nextRowIndex].appendChild(clone);
                    }
                }
            }
        }
        selected = table.querySelectorAll("["+ attrName +"]");
        addSelectedAttr(selected, table, {byResetButton: true});
        if(changed){
            rireki_make(motoHTML);
        }
    }

    function to_th_or_td(table, tagName){
        var selectedcells;
        selectedcells = table.querySelectorAll("["+ attrName +"]");
        var motoHTML = document.querySelector("#" + table_wrap_id).innerHTML;
        var changed = false;
        forEach.call(selectedcells, function(cell){
            if(cell.tagName === tagName.toUpperCase()){
                //alert("すでに" + tagName + "やん");
                return;
            } else {
                var elm = document.createElement(tagName);
                elm.innerHTML = cell.innerHTML;
                //console.log(cell.attributes);
                forEach.call(cell.attributes, function(attribute){
                    elm.setAttribute(attribute.nodeName, cell.getAttribute(attribute.nodeName));
                });
                cell.parentNode.insertBefore(elm, cell);
                cell.parentNode.removeChild(cell);
                changed = true;
            }
        });
        selectedcells = table.querySelectorAll("["+ attrName +"]");
        addSelectedAttr(selectedcells, table, {byResetButton: true});
        if(changed){
            rireki_make(motoHTML);
        }
    }



    function mergeCell(table) {
        var mergeable = true, //マージできそうかどうか
			reason = "No Rect"; //マージできない理由
		var selectedcell1;
		var selectedcells;
		var rowsInSection;
		var rowsHasSelected = [];
		var HowManyCellArr = [];//各行がselectedをいくつ持っているかを格納する配列。
		var mergedHTML;
        var HowManyCellArrfirst = false;
        var motoHTML = document.querySelector("#" + table_wrap_id).innerHTML;
        function mergeable_check(){
			
			selectedcells = table.querySelectorAll("["+ attrName +"]");
			selectedcell1 = table.querySelector("["+ attrName +"]");
			if(selectedcells.length === 0){
				mergeable = false;
				reason = "No cell is selected.";
				return;
			}else if(selectedcells.length === 1){
				mergeable = false;
                reason = "Only 1 cell is selected.";
                //console.log(selectedcells[0].outerHTML);
				return;
			}
	
            rowsInSection = selectedcell1.parentNode.parentNode.rows;
            //選択を持ってる行だけ集める→rowSpanがあったら次の行も入れたい
			forEach.call(rowsInSection, function(row, i, rows){
                if(row.querySelector("["+ attrName +"]")){//選択を1個でも持ってたら
                    rowsHasSelected[i] = row;//pushだと余分に足されるから
                    var cells = row.querySelectorAll("["+ attrName +"]");
                    forEach.call(cells, function(cell){
                        if(cell.rowSpan > 1){//rowspanが2以上だったら次の行も入れる
                            for(var j = 1; j < cell.rowSpan; j++){
                                if(!rowsHasSelected[i + j]){//なければ入れる
                                    //console.log(i + j);
                                    rowsHasSelected.push(rows[i + j]);
                                }else{
                                    //console.log("もう"+(i+j)+"行目はあるね");
                                }
                            }
                        }
                    });
				}
			});
			//console.log(rowsHasSelected);

            //選択されてる行に選択が何個ずつあるかを配列に格納
			rowsHasSelected.forEach(function(row, i/* , arr */){
                var cells = row.querySelectorAll("["+ attrName +"]");
				forEach.call(cells, function(cell){
					if(HowManyCellArr[i]){//既にその行があれば
						HowManyCellArr[i] += cell.colSpan;
					}else{
						HowManyCellArr[i] = cell.colSpan;
					}
					if(cell.rowSpan > 1){//rowspanが2以上だったら次の行に足す
						for(var j = 1; j < cell.rowSpan; j++){
							if(HowManyCellArr[i + j]){
								HowManyCellArr[i + j] += cell.colSpan;
							}else{
								HowManyCellArr[i + j] = cell.colSpan;
							}
						}
					}
				});
			});
            //console.log(HowManyCellArr);
            //各行のselectedの数が同じだったらtrueが入る。
            
			var everyRow = HowManyCellArr.every(function(elm, i, arr){
                if(HowManyCellArrfirst === false){
                    HowManyCellArrfirst = i;
                }
				return (elm === arr[HowManyCellArrfirst]);
			});
			if(!everyRow){
                mergeable = false;
                //alert("各行のselectedの数がちゃいまっせー");
				return;
			}
        }
        mergeable_check();
        
        if (mergeable) {
            rireki_make(motoHTML);
            //マージ＝1個目のセルを拡大してから、不要なセルを消す
            //alert("Mergeable");
            mergedHTML = selectedcell1.innerHTML;
			forEach.call(selectedcells, function(cell, i/* , arr */){
				if(i !== 0){
					mergedHTML = mergedHTML + ", " + cell.innerHTML;
					cell.parentNode.removeChild(cell);
				}
			});
			selectedcell1.colSpan = HowManyCellArr[HowManyCellArrfirst];
            selectedcell1.rowSpan = HowManyCellArr.length - HowManyCellArrfirst;
            selectedcell1.innerHTML = mergedHTML;
        } else {
            alert("Can't merge. (" + reason + ")");
        }
    }


    function addSelectedAttr(cells, table, option) {
        if(!option || !option.byResetButton){//リセットモードの時にやるとループするからしない
            var dialog = document.getElementById("jzmstrjp_table_editor_dialog");
            var table_wrap = document.getElementById("jzmstrjp_table_editor_dialog_wrap");
            tableReset(dialog, table_wrap, table_wrap.innerHTML);//入れ替えればイベント消える？
        }

        //ドラッグしたらハイライト
        dragMode = false;
        //cell1; //最初に触れたセル
        leftEnd = false;
        rightEnd = false;
        topEnd = false;
        bottomEnd = false;
        var allCells;

        Array.prototype.forEach.call(cells, function (cell /* , i, arr */ ) {
            cell.addEventListener("mousedown", function () {
                //console.log("mousedown");
                allCells = document.querySelectorAll("#jzmstrjp_table_editor_dialog_wrap > table > * > tr > *");
                forEach.call(allCells, function (elm) {
                    elm.removeAttribute(attrName);
                });
                dragMode = true;
                cell1 = cell;
                selectRect(this, table, {first: true});
                this.setAttribute(attrName, "true");
            });
            cell.addEventListener("mouseenter", function () {
                //同一セクション内のみハイライト
                if (dragMode && this.parentNode.parentNode === cell1.parentNode.parentNode) {
                    //this.setAttribute(attrName, "true");
                    //console.log("mouseenter", this);
                    selectRect(this, table);
                }
            });
        });
        document.body.addEventListener("mouseup", function () {
            if(!dragMode){
                return;
            }
            //console.log("mouseup");
            dragMode = false;
            leftEnd = false;
            rightEnd = false;
            topEnd = false;
            bottomEnd = false;
        });

        /* document.querySelector("#jzmstrjp_table_editor_dialog .modal-body-inner").addEventListener("click", function (e) {
        	if(e.target === this){
        		forEach.call(cells, function(elm){
        			elm.removeAttribute(attrName);
        		});
        	}
        }); */

        function selectRect(cell, table, option) {
            var nowTable = document.querySelector("#jzmstrjp_table_editor_dialog_wrap > table");
            var cellPos = get_cell_pos(nowTable, cell);
            var cellMap = get_cell_map(nowTable);
            //var colSpan = cell.colSpan - 1;
			//var rowSpan = cell.rowSpan - 1;
			
            if (leftEnd === false || cellPos.x < leftEnd) {
                leftEnd = cellPos.x;
            }
            if (rightEnd === false || rightEnd < cellPos.x + cell.colSpan - 1) {
                rightEnd = cellPos.x + cell.colSpan - 1;
            }
            if (topEnd === false || cellPos.y < topEnd) {
                topEnd = cellPos.y;
            }
            if (bottomEnd === false || cellPos.y + cell.rowSpan - 1 > bottomEnd) {
                bottomEnd = cellPos.y + cell.rowSpan - 1;
            }

            if(option && option.first){
                return;
            }

            //console.log("t:" + topEnd, "r:" + rightEnd, "b:" + bottomEnd, "l:" + leftEnd);
            for(var i = leftEnd; i <= rightEnd; i++){
                for(var j = topEnd; j <= bottomEnd; j++){
                    if (!cellMap[j][i].getAttribute(attrName)) { //既にselectedで無ければ
                        //console.log("selected追加");
                        cellMap[j][i].setAttribute(attrName, "true");
                    }
                }
            }            
        }
    }



    

    function replace(editedTable) {
        var html = editedTable.innerHTML;
        var selection = editor.getSelections()[0];
        editor.document.replaceRange(html, selection.start, selection.end);
    }


    function get_cell_pos(tableElement, cellElement) {
        var map = [];
        var i, j, p, x, y, x_end, y_end;
        var parent;
        var row;
        var rows = tableElement.rows;
        var row_num = rows.length;
        var cell;
        var cells;
        var cell_num;
        if (!row_num) {
            return null;
        }

        for (j = 0; j < row_num; j++) {
            p = 0;
            row = rows[j];
            if (parent != row.parentNode) {
                parent = row.parentNode;
                for (y = j; rows[y]; y++) {
                    if (parent != rows[y].parentNode) {
                        break;
                    }
                    map[y] = [];
                }
            }

            cells = row.cells;
            cell_num = cells.length;
            for (i = 0; i < cell_num; i++) {
                cell = cells[i];
                while (map[j][p]) {
                    p += 1;
                }
                if (cell === cellElement) {
                    return {
                        x: p,
                        y: j
                    };
                }

                x_end = p + cell.colSpan;
                y_end = j + cell.rowSpan;
                for (y = j; y < y_end; y++) {
                    if (!map[y]) {
                        break;
                    }
                    for (x = p; x < x_end; x++) {
                        map[y][x] = cell;
                    }
                }
            }
        }

        return null;
    }

    function get_cell_map(tableElement) {
    	var map = [];
    	var i, j, p, x, y, x_end, y_end;
    	var parent;
    	var row;
    	var rows = tableElement.rows;
    	var row_num = rows.length;
    	var cell;
    	var cells;
    	var cell_num;
    	if (!row_num) {
    		return map;
    	}

    	for (j = 0; j < row_num; j++) {
    		p = 0;
    		row = rows[j];
    		if (parent != row.parentNode) {
    			parent = row.parentNode;
    			for (y = j; rows[y]; y++) {
    				if (parent != rows[y].parentNode) {
    					break;
    				}
    				map[y] = [];
    			}
    		}

    		cells = row.cells;
    		cell_num = cells.length;
    		for (i = 0; i < cell_num; i++) {
    			cell = cells[i];
    			while (map[j][p]) {
    				p += 1;
    			}

    			x_end = p + cell.colSpan;
    			y_end = j + cell.rowSpan;
    			for (y = j; y < y_end; y++) {
    				if (!map[y]) {
    					break;
    				}
    				for (x = p; x < x_end; x++) {
    					map[y][x] = cell;
    				}
    			}
    		}
    	}

    	return map;
    }

    function init() {
        editorContextMenu.addMenuDivider();
        editorContextMenu.addMenuItem("jzmstrjp.paste_and_table.open_table_editor");
    }

    AppInit.appReady(function () {
        init();
    });
});