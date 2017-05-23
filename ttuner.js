window.onload = function () {


	//defaults first. Later loading things might overwrite these
	var startingNote="A";
	var startingFreq=415.3;
	var currentPlaybackNote="A";
	var octave="-1"; // switch octaves at C always? see how console version worked (for batch mode)



	//variables accessible to other functions
	var audioContext = new (window.AudioContext || window.webkitAudioContext)();
	var gain = audioContext.createGain();
	var oscillator;
	var loading=false; //to block unnecessary recalculations
	

	var ruleList = [];
	var notes = {};
	var sortedNotes=[]; //array of notes, in order of frequency - update it whenever notes changes!

	var localStorageAvailable = true;

	
	var storagePrefix = "ttuner_";
	var i;


	for (i=0; i<availableTemperaments.length; i++) {
		availableTemperaments[i].builtin=true;
	}
	
	refreshTemperamentList();
	loadLocalSettings();
	addListeners();
	loadCurrentTemperament();
	
	
	//===========functions===============
	function sortNotes() {
		sortedNotes = Object.keys(notes).sort(function(a,b){return notes[b]-notes[a]});
	}

	function refreshTemperamentList() {
		//update the html to show the available temperaments
		var temperamentList = document.getElementById("availabletemperaments");
		var newTemperament;
		var i;

		temperamentList.innerHTML = ""; //clear the list and rebuild

		//TODO add local temperaments to this list first
		for (i=0; i<availableTemperaments.length; i++) {
			newTemperament = document.createElement("option");
			newTemperament.innerHTML = availableTemperaments[i].name;
			if (availableTemperaments[i].builtin) {
				newTemperament.className = "builtin";
			}
			temperamentList.appendChild(newTemperament);
		}
	}

	function loadLocalSettings() {

		if (typeof(Storage) === "undefined") {
			// Sorry! No Web Storage support..
			alert("No Web Storage support: no saving or loading will work");
			localStorageAvailable = false;
		}

		else {
			//load local temperaments
			//TODO

			//load local settings, setting defaults for anything missing.


			if (restoreFromStorage("startingNote")) {
				//FIXME validate
				startingNote=restoreFromStorage("startingNote");
			} 
			
			if (restoreFromStorage("startingFreq")) {
				//FIXME validate
				startingFreq=restoreFromStorage("startingFreq");
			} 

			//TODO current temperament
			//(name, description, rules)

			if (restoreFromStorage("currentPlaybackNote")) {
				//FIXME validate
				currentPlaybackNote=restoreFromStorage("currentPlaybackNote");
			} 

		}

		//populate html with settings
		document.getElementById("startingNote").value=startingNote;
		document.getElementById("startingFreq").value=startingFreq;
	}

	function addListeners() {
		//add listeners to all the form fields so they do what we want!
		document.getElementById("newRule").onclick = function () { 
			//TODO separate this out so that it can be reused when loading a temperament
			rulesList = document.getElementById("rulesList");
			var newRule = createRuleHTML();
			rulesList.appendChild(newRule);

			editRule(newRule);
		};


		//when clicking on the temperament list, show the description
		var temperamentList = document.getElementById("availabletemperaments");

		temperamentList.onclick = function() {
			//get the selected temperament
			var selectedTemperament = this.options[this.selectedIndex].value;
			var descriptionParagraph = document.getElementById("temperamentdescription");
			
			//find the description for that temperament name
			var i;
			for (i=0; i<availableTemperaments.length; i++) {
				if (availableTemperaments[i].name == selectedTemperament) {
					descriptionParagraph.innerHTML = availableTemperaments[i].description;
					break;
				}
			}

		}

		//load temperament
		var temperamentButton = document.getElementById("loadtemperament");

		temperamentButton.onclick = function() {
			//get the selected temperament
			var selectedTemperament = temperamentList.options[temperamentList.selectedIndex].value;

			var i;
			for (i=0; i<availableTemperaments.length; i++) {
				if (availableTemperaments[i].name == selectedTemperament) {
					loadTemperament(availableTemperaments[i]);
					break;
				}
			}
		}

		//new temperament

		var newTempButton = document.getElementById("newtemperament");
		newTempButton.onclick = function() {
			//clear rules list (html and variable), and notes, and remove name/description
			document.getElementById("rulesList").innerHTML = "";
			document.getElementById("temperamentName").value="";
			document.getElementById("temperamentDescription").innerHTML="";
			notes={};
			ruleList=[];
			recalculate();
		}

		//playback buttons

		//current note's position in the sorted notes array
		var currentNotePosition = sortedNotes.indexOf(currentPlaybackNote);

		document.getElementById("prevnote").onclick=function() {
			currentNotePosition++;
			if (currentNotePosition >= sortedNotes.length) { currentNotePosition = 0; }
			currentPlaybackNote = sortedNotes[currentNotePosition];
			updatePlaybackNote();
		}
		document.getElementById("nextnote").onclick=function() {
			currentNotePosition--;
			if (currentNotePosition < 0) { currentNotePosition = sortedNotes.length-1; }
			currentPlaybackNote = sortedNotes[currentNotePosition];
			updatePlaybackNote();
		}

		//start/stop
		document.getElementById("playstopbutton").onclick = function() {
			//if we're playing, stop, otherwise, start! and toggle the name of the button.
			if (this.value == "play") {
				oscillator = audioContext.createOscillator();
				oscillator.type="sawtooth";
				oscillator.connect(gain);
				gain.connect(audioContext.destination);
				gain.gain.value=document.getElementById("volumeslider").value;

				oscillator.frequency.value=getCurrentFrequency();
				oscillator.start();
				this.value = "stop";
			}

			else {
				oscillator.stop();	
				delete oscillator;
				delete gain;
				this.value = "play";
			}

			
		}

		document.getElementById("octaveup").onclick = function() {
			octave++;
			updatePlaybackNote();
		}

		document.getElementById("octavedown").onclick = function() {
			octave--;
			updatePlaybackNote();
		}

		document.getElementById("volumeslider").oninput = function() {
			if (oscillator) gain.gain.value = this.value;
		}
		
		document.getElementById("startingNote").onchange = function() {
			//if it's not good, print an error message and leave without changing anything.
			//clear old error message here
			this.className="";
			var errormessage = document.getElementById("startingNoteFreq").getElementsByClassName("notenameError")[0];
			if (errormessage) {
				document.getElementById("startingNoteFreq").removeChild(errormessage);
			}

			var validnote=checkNote(this.value);
			this.value = validnote['tidynote'];
			if (validnote['notename'] == true && validnote['accidental'] == true) {
				startingNote = this.value;
				recalculate();
				saveToStorage("startingNote", startingNote);
			}

			else {
				//print error
				this.className = "error";
				errormessage = document.createElement("span");
				errormessage.className = "errormessage notenameError";
				if (validnote['notename'] == false) {
					errormessage.innerHTML += "Invalid notename.";
				}
				if (validnote['accidental'] == false) {
					errormessage.innerHTML += "Invalid accidental.";
				}
				document.getElementById("startingNoteFreq").appendChild(errormessage);

			}
		}
		document.getElementById("startingFreq").onchange = function() {
			//validate that it's a valid frequency. Must be a number, between a certain range...? 20-20000?
			//if it's not good, print an error message and leave without changing anything.
			//clear old error message here
			this.className="";
			var errormessage = document.getElementById("startingNoteFreq").getElementsByClassName("frequencyError")[0];
			if (errormessage) {
				document.getElementById("startingNoteFreq").removeChild(errormessage);
			}

			if (!isNaN(this.value) && this.value > 20 && this.value < 20000 ) {
				startingFreq = this.value;
				recalculate();
				saveToStorage("startingFreq", startingFreq);
			}
			else {
				//print error
				this.className = "error";
				errormessage = document.createElement("span");
				errormessage.className = "errormessage frequencyError";
				errormessage.innerHTML += "Invalid frequency. Acceptable values: 20-20000Hz.";
				document.getElementById("startingNoteFreq").appendChild(errormessage);
			}
		}
	}

	function getCurrentFrequency() {
		return  notes[currentPlaybackNote] * Math.pow(2,octave);
	}

	function createRuleHTML(newNote1, newNote2, newFraction, newComma) {
		//returns an li for insertion into the list of rules. 
		var newRule = document.createElement("li");
		
		var note1 = document.createElement("input");
		var note2 = document.createElement("input");
		var fraction = document.createElement("input");
		
		var comma = document.createElement("select");
		var PComma = document.createElement("option");
		var SComma = document.createElement("option");
		PComma.value="P";
		PComma.innerHTML="Pythagorean";
		SComma.value="S";
		SComma.innerHTML="Syntonic";
		comma.appendChild(PComma);
		comma.appendChild(SComma);

		note1.className = "note1";
		note2.className = "note2";
		fraction.className = "fraction";
		comma.className = "comma";

		note1.size=3;
		note2.size=3;
		fraction.size = 6;


		note1.disabled=true;
		note2.disabled=true;
		fraction.disabled=true;
		comma.disabled=true;

		if (newNote1) note1.value=newNote1;
		if (newNote2) note2.value=newNote2;
		if (newFraction) fraction.value=newFraction;
		if (newComma == "P") { comma.options[0].selected=true; }
		if (newComma == "S") { comma.options[1].selected=true; }

		newRule.appendChild(note1);
		newRule.appendChild(note2);
		newRule.appendChild(fraction);
		newRule.appendChild(comma);
		return newRule;

	}
		
	function loadTemperament(temperament) {
		loading = true;

		//takes a temperament object (name, description, rules[]) and loads it into the rule list, and updates the html and recalculates
		var i;
		
		//clear existing rules and html
		ruleList = [];
		rulesList = document.getElementById("rulesList");
		rulesList.innerHTML = "";

		var newRule;
		var rules = rulesList.getElementsByTagName("li");

		//set name and description
		var nameInput = document.getElementById("temperamentName");
		var description = document.getElementById("temperamentDescription");

		nameInput.value = temperament.name;
		description.innerHTML = temperament.description;

		newRuleButton = document.getElementById("newRule");


		for (i=0; i<temperament.rules.length; i++) {
			if (temperament.rules[i] == null) { continue; }
			newRuleButton.click();
			newRule = rules[rules.length-1];
			newRule.getElementsByClassName("note1")[0].value=temperament.rules[i].note1;
			newRule.getElementsByClassName("note2")[0].value=temperament.rules[i].note2;
			newRule.getElementsByClassName("fraction")[0].value=temperament.rules[i].fraction;
			newRule.getElementsByClassName("comma")[0].value=temperament.rules[i].comma;
			
			
			newRule.getElementsByClassName("okButton")[0].click();
		}
		loading=false;

		recalculate();
	}

	function saveCurrentTemperament() {
		var i;
		var currentTemperament = {};
		currentTemperament.name = document.getElementById("temperamentName").value;
		currentTemperament.description = document.getElementById("temperamentDescription").innerHTML;
		currentTemperament.rules=[];
		for (i=0; i<ruleList.length; i++) {
			if (ruleList[i] == null) continue;
			currentTemperament.rules.push({
				"note1": ruleList[i].note1, 
				"note2": ruleList[i].note2, 
				"fraction": ruleList[i].fraction, 
				"comma": ruleList[i].comma
			});
		}

		saveToStorage("currentTemperament", currentTemperament);
	}
		

	function loadCurrentTemperament() {	
		//load current temperament (if there is one)

		if (restoreFromStorage("currentTemperament")) {
			//FIXME validate
			var newTemperament=restoreFromStorage("currentTemperament");
			loadTemperament(newTemperament);
		} 

	}

	function editRule(ruleLi) {
		var currentID=ruleLi.getAttribute("data-ruleid");

		//remove the edit button, to replace it with delete/cancel buttons
		editButton = ruleLi.getElementsByClassName("editRuleButton");
		if (editButton.length> 0) { editButton[0].remove(); }
		
		//add cancel/delete buttons to this rule (delete, only if it has an ID)

		//make a delete button
		//IF there's an id set, make a cancel button
		//if no id is set, rename delete to cancel.

		var deletebutton = document.createElement("input");
		deletebutton.type="submit";
		deletebutton.value="Delete";
		deletebutton.onclick = function() {
			if (currentID) {
				delete ruleList[currentID];
			}
			this.parentElement.remove();

			recalculate();
		}
		ruleLi.appendChild(deletebutton);

		if (currentID) {
			var cancelbutton = document.createElement("input");
			cancelbutton.type="submit";
			cancelbutton.value="Cancel";
			cancelbutton.onclick = function() {
				//FIXME restore info from list
			}
			ruleLi.appendChild(cancelbutton);
		}
		else {
			//if this is a new one, Canceling is just deleting!
			deletebutton.value="Cancel";
		}

		//activate the inputs
		enableInputs(ruleLi);

		//add an ok button, to save the info
		var okButton = document.createElement("input");
		okButton.type="Submit";
		okButton.value="Ok";
		okButton.className="okButton";
		okButton.onclick = function() {
			//here we check the rule for validity
			//first, extract the data from the form

			var rule={};
			var note1 = ruleLi.getElementsByClassName("note1")[0];
			var note2 = ruleLi.getElementsByClassName("note2")[0];
			var fraction = ruleLi.getElementsByClassName("fraction")[0];
			var comma =  ruleLi.getElementsByTagName("select")[0];

			var errormessage="";

			rule['note1'] = note1.value;
			rule['note2'] = note2.value;
			rule['fraction'] = fraction.value;
			rule['comma'] = comma.value;


			rule['ID'] = currentID;
			
			rule = checkRule(rule);
				
			//insert the sanitized values into the html
			note1.value = rule['note1'];
			note2.value = rule['note2'];
			fraction.value = rule['fraction'];
			comma.value = rule['comma'];

			//clear any error classes and messages that may have been set
			note1.className = "note1";
			note2.className = "note2";
			fraction.className = "fraction";

			var errorMessageContainer = ruleLi.getElementsByClassName("errormessage")[0];
			if (errorMessageContainer) {
				ruleLi.removeChild(ruleLi.getElementsByClassName("errormessage")[0]);
			}
				
			if (rule.valid.errors == 0) {
				//it's good!
				//deactivate the input boxes
				//restore all the edit buttons.

				disableInputs(ruleLi);

				//remove the error info from the rule
				delete rule.valid;

				//add to rule list and recalculate notes
				var newId=addRule(rule);
				if (newId != currentID) {
					ruleLi.setAttribute("data-ruleid", newId);
				}			

				//and reset all the buttons back to normal - remove the cancel and delete, and turn this Ok back into an Edit.
				var buttonsToDelete=Array.prototype.slice.call(ruleLi.getElementsByTagName("input"));
				for (i=0; i<buttonsToDelete.length; i++) {
					if (buttonsToDelete[i].type=="submit") { 
						ruleLi.removeChild(buttonsToDelete[i]); 
					}
				}

				var editButton = document.createElement("input");
				editButton.type="Submit";
				editButton.value="Edit";
				editButton.className="editRuleButton";
				editButton.onclick = function() {
					editRule(this.parentNode);
				}
				ruleLi.appendChild(editButton);

				//this shouldn't be called when loading a temperament, since then it fires every single rule!
				if (!loading) { recalculate(); }

			}
			//TODO if it's not good, highlight it in red, with an error message
			else if (rule['valid']) { 
				//the array in 'valid' will tell us which field had the error.
				//also check for duplicates TODO in ['valid']['duplicate']
				if (rule['valid']['note1']) {
					errormessage += "Note1: ";
					errormessage += rule['valid']['note1'].join(", ")+" ";
					//set the error class on the note1input
					note1.className += " error";
				}
				if (rule['valid']['note2']) {
					errormessage += "Note2: ";
					errormessage += rule['valid']['note2'].join(", ")+" ";
					//set the error class on the note2input
					note2.className += " error";
				}
				if (rule['valid']['interval']) {
					errormessage += "Invalid interval: ";
					errormessage += rule['valid']['interval'];
					note1.className += " error";
					note2.className += " error";
				}
				if (rule['valid']['fraction']) {
					errormessage += "Fraction: ";
					errormessage += rule['valid']['fraction'].join(", ")+" ";
					//set the error class on the note2input
					fraction.className += " error";
				}

				errorMessageContainer = document.createElement("span");
				errorMessageContainer.className="errormessage";
				//FIXME what's with the space? Just positioning, I think... better to do that in CSS..?
				errorMessageContainer.innerHTML = " " +errormessage;
				ruleLi.appendChild(errorMessageContainer);

			}

		
		}
		ruleLi.appendChild(okButton);
			
	}

	//recalculate notes
	function recalculate() {
		//TODO this should be smart enough to only recalculate what's necessary. right now it redoes everything every time.

		//start with the startingNote (i.e. tuning fork!)
		notes = {};
		notes[startingNote] = startingFreq;

		//next, step through the rules list until we stop finding new frequencies
		var noteFound = true;
		var i;
		var tuneFrom;
		var tuneTo;
		var tuneFraction;
		var tuneComma;
		var inverted; //whether the interval is inverted, i.e. a 4th instead of a 5th
		var semitones; //number of semitones in the interval
		var newFrequency;
		var PComma = 1.01364326477050781; // ((3^12)/(2^12*2^6))/2
		var SComma = 1.0125; // ((3*3*3*3)/(2*2*2*2*2*2))/1.25
		var fraction;

		var slashpos;


		while (noteFound) {

			noteFound=false;
			for (i=0; i<ruleList.length; i++) {
				if (ruleList[i] == undefined) { continue; }
				
				//if we have one of the two notes in the relationship, calculate the other!

				if (notes[ruleList[i].note1] && !notes[ruleList[i].note2]) {
					tuneFrom=ruleList[i].note1;
					tuneTo = ruleList[i].note2;
				} else
				if (!notes[ruleList[i].note1] && notes[ruleList[i].note2]) {
					tuneFrom=ruleList[i].note2;
					tuneTo = ruleList[i].note1;
				}
				else { continue; }

				slashpos = (ruleList[i].fraction.indexOf('/'));

				if (slashpos) {
					tuneFraction = ruleList[i].fraction.slice(0,slashpos) / ruleList[i].fraction.slice(slashpos+1)
				}
				else if (ruleList[i].fraction) {
					tuneFraction = ruleList[i].fraction;
				}
				else tuneFraction = "0";
				
				if (ruleList[i].comma == 'P') { tuneComma = PComma; }
				if (ruleList[i].comma == 'S') { tuneComma = SComma; }



				//figure out the interval between the two notes and set the base ratio
				var interval = getInterval(tuneTo, tuneFrom);

				inverted = false;
				
				switch (interval.interval) {
					//perfect 5th/4th
					case "p5":
					ratio = 3/2;
					break;

					//major 3rd / minor 6th
					case "M3":
					ratio = 5/4;
					break;

					/*
					//minor 3rd - only do the 7/6 one, not the wonky 8/7 one.
					case "m3":
					ratio = 7/6;
					break;
					*/
				}

				if (interval.inverted) {
					ratio = 2/ratio;
					tuneFraction = tuneFraction * -1;
				}

				//modify the base ratio based on the relationship
				if (tuneFraction) {
					ratio = ratio * Math.pow(tuneComma, tuneFraction);
				}

				//set the new frequency
				newFrequency = notes[tuneFrom] * ratio;
				
				//put it in the right octave
				if (newFrequency > startingFreq*2) { newFrequency /= 2; }

				//save it in the array
				notes[tuneTo] = newFrequency;
				noteFound = true;

			}
		}
		sortNotes();
		updateDisplay();
		updatePlaybackNote();
		saveCurrentTemperament();
	}
	
	function getInterval(tuneTo, tuneFrom) {
		var semitones = getNoteNumber(tuneTo) - getNoteNumber(tuneFrom);
		if (semitones < 0) semitones += 12;
		var inverted = false;
		var interval;
		
		switch (semitones) {
			//perfect 5th/4th
			case 5:
			inverted=true;
			case 7:
			interval = "p5";
			break;

			//major 3rd / minor 6th
			case 8:
			inverted = true;
			case 4:
			interval="M3";
			break;

/*			//minor 3rd - only do the 7/6 one, not the wonky 8/7 one.
			case 9:
			inverted = true;
			case 3:
			interval = "m3";
			break;
*/
			default:
			interval = "invalid";
		}

		return {"interval": interval, "inverted": inverted};
		
	}


	function updatePlaybackNote() {
		//checks that the current playback note exists in the temperament, and updates the HTML accordingly
		if (!notes[currentPlaybackNote]) {
			currentPlaybackNote = startingNote;
		}

		document.getElementById("playbacknote").innerHTML = currentPlaybackNote;
		document.getElementById("playbackfrequency").innerHTML = Math.round(getCurrentFrequency()*100)/100+"Hz";

		if (oscillator) {
			oscillator.frequency.value=getCurrentFrequency();
		}

		saveToStorage("currentPlaybackNote", currentPlaybackNote);
	}

	function getNoteNumber(noteName) {
		//returns an integer: 
		/*
			1 = ♯, #
			2 = ♯♯, ##, ×, x
			-1 = ♭, b 
			-2 = ♭♭, bb
		*/
		var letter = noteName.slice(0,1);
		var noteNumber;
		switch (letter) {
			case 'A': noteNumber = 0; break;
			case 'B': noteNumber = 2; break;
			case 'C': noteNumber = 3; break;
			case 'D': noteNumber = 5; break;
			case 'E': noteNumber = 7; break;
			case 'F': noteNumber = 8; break;
			case 'G': noteNumber = 10; break;
		}
		
		var accidental = noteName.slice(1);

		switch (accidental) {
			case "♯":
			case "#":
				noteNumber++;
				break;

			case "♯♯":
			case "##":
			case "×":
			case "x":
				noteNumber += 2;
				break;

			case "♭":
			case "b":
				noteNumber--;
				break;

			case "♭♭":
			case "bb":
				noteNumber -= 2;
				break;
		}
		return noteNumber;
	}
	
	function updateDisplay() {
		//update the table of frequencies and cents (and other values)
		//eventually, update graphs too
		var i;
		var row;
		var nameCell;
		var frequencyCell;
		var centsCell;
		var decimals = 100; //used for rounding - TODO make this configurable

		var tableRows = document.getElementById('notestable').getElementsByTagName('tr');
		//delete all the old rows except for the table header
		while (tableRows.length > 1) { tableRows[1].remove(); }

		for (i=0; i<sortedNotes.length; i++) {
			row = document.createElement('tr');
			nameCell = document.createElement('td');
			frequencyCell = document.createElement('td');
			centsCell = document.createElement('td');
			nameCell.innerHTML = sortedNotes[i];
			frequencyCell.innerHTML = Math.round(notes[sortedNotes[i]]*100)/100;
			centsCell.innerHTML = Math.round(getCents(sortedNotes[i])*100)/100;

			row.appendChild(nameCell);
			row.appendChild(frequencyCell);
			row.appendChild(centsCell);

			document.getElementById('notestable').appendChild(row);
		}

	}

	function getCents(note) {
		var frequency = notes[note];
		var baseNote = startingNote; 
		var etFreq;

		if (note == baseNote) { etFreq = frequency }
		else { 
			//how many semitones away from baseNote?
			var distance = getNoteNumber(note) - getNoteNumber(baseNote);

			if (distance < 0) distance += 12;
			
			etFreq = startingFreq * Math.pow(2,distance/12);
		}

		return Math.log2(frequency/etFreq)*1200;

	}


	function addRule(rule) {
		//adds the data to the rules list and returns the id of the rule

		if (rule['id']) {
			//replace the existing rule
			ruleList[rule['id']]=rule;
			//don't want extra id values floating around in there where they shouldn't be!
			delete ruleList[rule['id']]['id'];
			return rule['id'];
		}
		else {
			//if id is 0, it's a new id
			//push the data into the list
			ruleList.push(rule);
			return ruleList.length-1;
		}


	}

	function saveToStorage(varName, variable) {
		if (localStorageAvailable) { 
			localStorage.setItem(storagePrefix+varName, JSON.stringify(variable)); 
		}
	}

	function restoreFromStorage(varName) {
		if (localStorageAvailable) {
			return JSON.parse(localStorage.getItem(storagePrefix+varName));
		}
		else return null;
	}

	function enableInputs(element) {
		var inputs = element.getElementsByTagName("input");
		var i;
		for (i=0; i<inputs.length; i++) {
			if (inputs[i].type == "text") inputs[i].disabled=false;
		}
		var select = element.getElementsByTagName("select");
		if (select[0]) select[0].disabled=false;
	}

	function disableInputs(element) {
		//disable all the input boxes inside an element
		var inputs = element.getElementsByTagName("input");
		var i;
		for (i=0; i<inputs.length; i++) {
			if (inputs[i].type == "text") inputs[i].disabled=true;
		}
		var select = element.getElementsByTagName("select");
		if (select[0]) select[0].disabled=true;
	}

	function checkNote(note) {
		//takes a note string, and checks if it's a real note name.
		//returns {notename:true,accidental: true} if it's good. Also has newnotename to make it pretty.
		var accidental;
		var notename = note[0];
		var valid = {"notename": true, "accidental": true, };
		if (!notename) notename = "";
		if (note.length > 1) { accidental = note.slice(1); }
		else { accidental = ''; }

		notename = notename.toUpperCase();

		if (notename.search(/[A-G]/) == -1) {
			valid['notename'] = false;
		}

		switch (accidental) {
			case '':
				break;

			case '#':
			case '♯':
			case '+':
				accidental = '♯';
				break;

			case 'b':
			case '-':
			case '♭':
				accidental = '♭';
				break;

			case '##':
			case '++':
			case '♯♯':
			case 'x':
			case '×':
				accidental = 'x';
				break;

			case 'bb':
			case '♭♭':
			case '--':
				accidental = '♭♭';
				break;

			default:
				valid['accidental'] = false;
				break;
		}

		valid['tidynote'] = notename+accidental;
		return valid;

	}

	function checkRule(rule) {
		//check the three rule parts. Return a sanitized version of the rule with an extra field 'valid':
		//valid contains info about the things that didn't work. If it doesn't have anything, all is well!

		var i;
		var note;
		var accidental;
		rule['valid'] = {'errors': 0};
		//clear whitespace for all values
		rule['note1'] = rule['note1'].replace(/\s/g, '');
		rule['note2'] = rule['note2'].replace(/\s/g, '');
		rule['fraction'] = rule['fraction'].replace(/\s/g, '');
		rule['comma'] = rule['comma'].replace(/\s/g, '');

		var errors;
		var validnote;

		//check notenames and accidentals, making uppercase
		for (i=1; i<3; i++) {
			errors = [];
			validnote = checkNote(rule['note'+i]);
			if (validnote['notename'] == false) { errors.push("Invalid note name"); }
			if (validnote['accidental'] == false) { errors.push("Invalid accidental"); }

			if (errors.length >0) { rule['valid']['note'+i] = errors; rule['valid']['errors']++; }
			else rule['note'+i] = validnote['tidynote'];

		}
		
		//check that it's a valid interval (5th/4th or major3rd/minor6th are the only ones supported (for now?)
		if (rule['valid']['errors'] == 0) { //don't bother checking if the note names have problems
			var interval = getInterval(rule['note1'], rule['note2']);
			if (interval.interval == "invalid") {
				rule['valid']['interval'] = "only perfect fifths and major thirds are allowed."
				rule['valid']['errors']++;
			}
		}


		//check the fraction next;
		var sign;
		var fraction = rule['fraction'];
		var numbers = [];
		var slashpos;
		errors = [];
		//should be blank, [+/-]number, number being either a straight number or else two numbers with a / 2nd number can't be negative.
		if (rule['fraction'].length > 0) {
			if (fraction[0] == '+' || fraction[0] == '-') {
				sign = fraction[0];
				fraction = fraction.slice(1);
			}


			slashpos = fraction.search('/');
			if (slashpos) {
				//this is a fraction!
				numbers = fraction.split('/');
			}
			else { numbers[0] = fraction; }

			for (i=0; i<numbers.length; i++) {
				//test the number(s) for validity.
				if (isNaN(numbers[i])) {
					rule.valid.errors++;
					errors.push("invalid fraction");
				}
			}
			if (errors.length>0) { rule['valid']['fraction'] = errors; };
			
		}


		return rule;
	}

}
