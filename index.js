<html>
<head>
<title>CustomDex - A simple manga reader powered by MangaDex API</title>
<meta name="description" content="A simple manga reader powered by MangaDex API">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta charset="UTF-8">
<script>
var dm = false; // dm = true for direct mode. Does not work with current Mangadex API because of CORS. dm = false to proxy queries
// Some shortcuts for common and generic functions
var J=JSON, r=J.parse, s=J.stringify, A=document;
var D = function(p) { return A.getElementById(p) };
var C = function(p) { return A.createElement(p) };
var q = function(method,path,callback) {
	let x = new XMLHttpRequest();
	x.open(method, dm ? path : "https://jsonp.afeld.me/?url="+escape(path), true);
	x.onreadystatechange = function() {
		if (x.readyState == 4) {
			callback(x.status == 200 ? r(x.responseText) : x.responseText, x.status);
		}
	};
	return x;
}
function G(path,callback) {
	let request = q("GET",path,callback);
	request.send();
}
function P(path,data,callback) {
	let request = q("POST",path,callback);
	x.setRequestHeader("Content-type", "application/json");
	x.send(s(data));
}

/*
* Reader specific stuff below
*/

// Max amount of result pages for big searches
var MAX_PAGES = 100;

// Global static variables for reader
var currentData = [];
var currentImages = [];
var currentHash = "";
var currentIdx = 0;
var currentMangaId = "";
var lastKnownSearch = "";

function searchInput(evt){
	if (evt.keyCode == 13) {
		evt.preventDefault();
		search();
	}
}

function tidyDescription(rawDesc){
	if (rawDesc == null) return "";
	// Thanks! u/thuniffe
	return rawDesc.replace(/\[(\/?[biu]|hr)\]/g,"<$1>").replaceAll("[*]","<br />")
	.replace(/\[url\=([^\]]+)\]([^\[]+)\[\/url\]/g,'<a href="$1">$2</a>').replace(/\[img\]([^\[]+)\[\/img\]/g,'<img src="$1">');

}

function splitTermToTitles(searchTerm) {
	if (searchTerm.indexOf(' ') < 0) return searchTerm;
	return searchTerm.trim().split(' ').join("+");
}

function search(){
	lastKnownSearch = splitTermToTitles(D("search_term").value);
	G("https://api.mangadex.org/manga?title="+lastKnownSearch+"&limit=100",populateManga);
}

function populateError(parent, code, text) {
	D("search_info").innerHTML = "Error " + code;
	D("manga_name").innerText="None";
	D("chapter_num").innerText = "None";
	if (text != null && text.length > 0) {
		parent.appendChild(addCell(C("tr"), text));
	}
}

function addCell(parent, text) {
	let tmp = C("td");
	tmp.innerHTML=text;
	parent.appendChild(tmp);
	return tmp;
}

function populateManga(resultJson, resultCode) {
	let a = D("search_results");
	D("manga_name").innerText="None";
	D("chapter_num").innerText = "None";
	while (a.firstChild) {
		a.removeChild(a.firstChild);
	}
	let resultList = resultJson != null ? resultJson.results : [];
	if (resultCode == 200 && resultList.length > 0) {
		let row = C("tr");
		addCell(row,"Title").style.width = "20%";
		addCell(row,"Description").style.width = "80%";
		a.appendChild(row);
		resultList.sort(nameSort);
		for (var resultObj in resultList) {
			let row = C("tr");
			let mangaName = unescape(resultList[resultObj].data.attributes.title.en);
			let mangaId = resultList[resultObj].data.id;
			let mandaNameCell = addCell(row, mangaName);
			addCell(row, tidyDescription(unescape(resultList[resultObj].data.attributes.description.en)));
			mandaNameCell.classList.add("link");
			mandaNameCell.addEventListener("click", () => {
				G("https://api.mangadex.org/chapter?manga="+mangaId+"&limit=100",populateChapters);
				currentMangaId = mangaId;
				D("manga_name").innerHTML=mangaName;
			});
			a.appendChild(row);
		}
		D("search_info").innerHTML = resultJson.total + " manga found!";
		if (resultJson.limit < resultJson.total) {
			createMangaPageButtons(resultJson.total, 2, "https://api.mangadex.org/manga?title="+lastKnownSearch+"&limit=100&offset=");
		}
	} else {
		if (resultCode == 204) {
			D("search_info").innerHTML = "No results";
		} else {
			populateError(a, resultCode, resultJson);
		}
	}
}



function createMangaPageButtons(total, tableCols, pageBaseUrl) {
	createPageButtons(total, tableCols, pageBaseUrl, populateManga)
}

function createChapterPageButtons(total, tableCols, pageBaseUrl) {
	createPageButtons(total, tableCols, pageBaseUrl, populateChapters)
}

function createPageButtons(total, tableCols, pageBaseUrl, callback) {
	let row = C("tr");
	let cell = C("td");
	cell.colSpan=tableCols;
	let pages = Math.ceil(total / 100.0);
	if (pages > MAX_PAGES) pages = MAX_PAGES;
	for (let i = 0; i < pages; i++) {
		let pageLink = C("div");
		pageLink.style.float="left";
		pageLink.style.margin="0.3em";
		pageLink.classList.add("link");
		pageLink.innerHTML = "Page " + (i+1);
		let offset=100*i;
		pageLink.addEventListener("click", ()=>{
			G(pageBaseUrl+offset,callback);
		});
		cell.appendChild(pageLink);
	}
	row.appendChild(cell);
	D("search_results").appendChild(row);
}

function populateChapters(resultJson, resultCode) {
	let a = D("search_results");
	while (a.firstChild) {
		a.removeChild(a.firstChild);
	}
	let resultList = resultJson != null ? resultJson.results : [];
	if (resultCode == 200 && resultList.length > 0) {
		let row = C("tr");
		addCell(row,"Chapter");
		addCell(row,"Title");
		addCell(row,"Language");
		addCell(row,"Date");
		a.appendChild(row);
		resultList.sort(chapterSort);
		
		for (let resultObj in resultList) {
			let row = C("tr");
			let chapterId = resultList[resultObj].data.id;
			let hashId = resultList[resultObj].data.attributes.hash;
			let pagesData = resultList[resultObj].data.attributes.dataSaver;
			let chapterNumber = resultList[resultObj].data.attributes.chapter;
			addCell(row, chapterNumber);
			addCell(row, unescape(resultList[resultObj].data.attributes.title));
			addCell(row, unescape(resultList[resultObj].data.attributes.translatedLanguage));
			addCell(row, (new Date(resultList[resultObj].data.attributes.publishAt)).toLocaleString());
			row.classList.add("link");
			row.addEventListener("click",()=> {
				prepareReader(chapterId, chapterNumber, hashId, pagesData);
			});
			a.appendChild(row);
		}
		D("search_info").innerHTML = resultJson.total + " chapter" + (resultJson.total != 1 ? "s":"") + " found!";
		if (resultJson.limit < resultJson.total) {
			createChapterPageButtons(resultJson.total, 4, "https://api.mangadex.org/chapter?manga="+currentMangaId+"&limit=100&offset=");
		}
	} else {
		if (resultCode == 204) {
			D("search_info").innerHTML = "No results";
		} else {
			populateError(a, resultCode, resultJson);
		}
	}
}

function nameSort(a,b){
	return a.data.attributes.title.en.localeCompare(b.data.attributes.title.en);
}

function chapterSort(a,b) {
	if (!isNaN(parseFloat(a.data.attributes.chapter)) && !isNaN(parseFloat(b.data.attributes.chapter))) return parseFloat(a.data.attributes.chapter) - parseFloat(b.data.attributes.chapter);
	return a.data.attributes.chapter.localeCompare(b.data.attributes.chapter);

}

function populateImages(serverJson) {
	let atHome = serverJson.baseUrl;
	let imgRoot = atHome + "/data-saver/" + currentHash + "/";
	currentImages = [];
	for (let i in currentData) {
		var newImg = C("img");
		newImg.src=imgRoot + currentData[i];
		currentImages.push(newImg);
	}
	refreshView();
}

function refreshView(){
	if (currentImages.length == 0 || currentIdx >= currentImages.length || currentIdx < 0){
		console.log("Invalid images");
		return;
	}
	let vtmp = D("view_mid");
	if (vtmp.firstChild != null) vtmp.removeChild(vtmp.firstChild);
	vtmp.appendChild(currentImages[currentIdx]);
	
	vtmp = D("view_right");
	if (vtmp.firstChild != null) vtmp.removeChild(vtmp.firstChild);
	if (currentIdx > 0) {
		vtmp.appendChild(currentImages[currentIdx-1]);
	}
	
	vtmp = D("view_left");
	if (vtmp.firstChild != null) vtmp.removeChild(vtmp.firstChild);
	if (currentIdx+1 < currentImages.length) {
		vtmp.appendChild(currentImages[currentIdx+1]);
	}
	
	D("search").style.display="none";
	D("view").style.display="block";
}

function prepareReader(chapterId, chapterNumber, hashId, pagesData) {
	currentHash = hashId;
	currentData = pagesData;
	currentIdx = 0;
	D("chapter_num").innerText = chapterNumber;
	G("https://api.mangadex.org/at-home/server/"+chapterId,populateImages);
}

function movePage(step){
	currentIdx+=step;
	if (currentIdx < 0) currentIdx = 0;
	else if (currentImages != null && currentIdx >= currentImages.length) currentIdx = currentImages.length-1;
	refreshView();
}

function showSearch() {
	D("view").style.display="none";
	D("search").style.display="block";
}

function shortcuts(evt) {
	if (evt.srcElement == D("search_term")) return;
	if (evt.keyCode == 37 || evt.keyCode == 65) {
		movePage(1)
	} else if (evt.keyCode == 39 || evt.keyCode == 68) {
		movePage(-1);
	}
}

document.addEventListener("keydown", shortcuts);

</script>
<style>
#view {display:none;width=100%;height=100%}
#search {display:block;width:100%;height:100%}
#search_results tr {background-color:#fafafa;margin:0.5em}
#search_results tr:nth-child(odd) {background-color:#e6e2e1;margin:0.5em}
.link,.view_preview {cursor: pointer;}
.view_preview img {margin-top:5%;float:left;width:5%}
.view_main img {margin:auto;float:left;width:80%;object-fit:contain}
</style>
</head>
<body>
<div id="view">
<input type="button" onclick="showSearch()" value="Back to Search"/>
<div id="view_left" onclick=movePage(1) class="view_preview"></div>
<div id="view_mid" class="view_main"></div>
<div id="view_right" onclick=movePage(-1) class="view_preview"></div>
</div>
<div id="search">
<input type="text" id="search_term" onkeydown="searchInput(event)"/>
<input type="button" onclick="search()" value="Search Manga"/>
<label for="search_term" id="search_info"></label>
<div id="manga_name">None</div>
<div id="chapter_num">None</div>
<table id="search_results"></table>
</div>
</body>
</html>
