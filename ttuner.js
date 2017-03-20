window.onload = function () {


	//defaults first. Later loading things might overwrite these
	var startingNote="A";
	var startingFreq=415.3;
	var playbackNote="A";
	var octave="-1"; // switch octaves at C always? see how console version worked (for batch mode)
	
	//variables accessible to other functions
	var ruleList = [];
	var notes = {};

	var localStorage = true;

	
	var i;

	for (i=0; i<availableTemperaments.length; i++) {
		availableTemperaments[i].builtin=true;
	}
	
	refreshTemperamentList();
	loadLocalSettings();
	loadCurrentTemperament();
	addListeners();
	
	
	//===========functions===============
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

		//FIXME don't bail - everything but saving still works
		//this surely won't work?
		if (typeof(Storage) === "undefined") {
			// Sorry! No Web Storage support..
			alert("No Web Storage support: no saving or loading will work");
			localStorage = false;
		}

		else {
			//load local temperaments
			//TODO

			//load local settings, setting defaults for anything missing.


			if (localStorage.startingNote) {
				//FIXME validate
				startingNote=localStorage.startingNote;
			} 
			if (localStorage.startingFreq) {
				//FIXME validate
				startingFreq=Number(localStorage.startingFreq);
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

		note1.placeholder = "B";
		note2.placeholder = "E♭";
		fraction.placeholder = "-1/6";

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
		//takes a temperament object (name, description, rules[]) and loads it into the rule list, and updates the html and recalculates
		var i;
		
		//clear existing rules and html
		ruleList = temperament.rules;
		rulesList = document.getElementById("rulesList");
		rulesList.innerHTML = "";

		var newRule;

		//set name and description
		var nameInput = document.getElementById("temperamentName");
		var description = document.getElementById("temperamentDescription");

		nameInput.value = temperament.name;
		description.innerHTML = temperament.description;

		for (i=0; i<temperament.rules.length; i++) {
			newRule = createRuleHTML(temperament.rules[i].note1, temperament.rules[i].note2, temperament.rules[i].fraction, temperament.rules[i].comma);
			rulesList.appendChild(newRule);
		}
		recalculate();
	}
		

	function loadCurrentTemperament() {
		//load current temperament (if there is one)

		//calculate note values
		recalculate();
	}

	function editRule(ruleLi) {
		var currentID=ruleLi.getAttribute("data-ruleid");

		//remove the edit button, to replace it with delete/cancel buttons
		editButton = ruleLi.getElementsByClassName("editRuleButton");
		if (editButton.length> 0) { editButton[0].remove(); }
		
		//disable edit,delete buttons on other rules, and 'new rule' button
		disableButtons();
		

		//add cancel/delete buttons to this rule (delete, only if it has an ID)

		//make a delete button
		//IF there's an id set, make a cancel button
		//if no id is set, rename delete to cancel.

		document.getElementById("newRule").disabled=true;
		
		var deletebutton = document.createElement("input");
		deletebutton.type="submit";
		deletebutton.value="Delete";
		deletebutton.onclick = function() {
			if (currentID) {
				delete ruleList[currentID];
			}
			this.parentElement.remove();
			enableButtons();
			recalculate();
		}
		ruleLi.appendChild(deletebutton);

		if (currentID) {
			var cancelbutton = document.createElement("input");
			cancelbutton.type="submit";
			cancelbutton.value="Cancel";
			cancelbutton.onclick = function() {
				//FIXME restore info from list
				enableButtons();
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
		okButton.onclick = function() {
			//here we check the rule for validity
			//first, extract the data from the form
			var ruleParts=[];
			var inputs = ruleLi.getElementsByTagName("input");
			for (i=0; i<inputs.length; i++) {
				if (inputs[i].type == "text") ruleParts.push(inputs[i].value);

			}
			var select = ruleLi.getElementsByTagName("select");
			if (select[0]) { 
				ruleParts.push(select[0].value)
			};
				

			var result = checkRule(ruleParts[0], ruleParts[1], ruleParts[2], ruleParts[3]);
			if (result == 0) {
				//if it's good, add it to the rule list, deactivate the input boxes, and restore all the edit buttons.
				disableInputs(ruleLi);
				enableButtons();

				//add to rule list and recalculate notes
				var newId=addRule(ruleParts[0], ruleParts[1], ruleParts[2], ruleParts[3], currentID);
				if (newId != currentID) {
					ruleLi.setAttribute("data-ruleid", newId);
				}			

				recalculate();

			}
			//TODO if it's not good, highlight it in red, with an error message
			else if (result == -1) { alert("Parse error"); }
			else { alert("duplicate rule: " + result); }

		
			//and reset all the buttons back to normal - reactivate newRule, reactivate all the edits, remove the cancel and delete, and turn this Ok back into an Edit.
			enableButtons();
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



		}
		ruleLi.appendChild(okButton);
			
	}

	//recalculate notes
	function recalculate() {
		//TODO this should be smart enough to only recalculate what's necessary. right now it redoes everything every time.

		//start with the startingNote (i.e. tuning fork!)
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
				semitones = getNoteNumber(tuneTo) - getNoteNumber(tuneFrom);
				if (semitones < 0) semitones += 12;
				inverted = false;

				
				
				switch (semitones) {
					//perfect 5th/4th
					case 5:
					inverted=true;
					case 7:
					ratio = 3/2;
					break;

					//major 3rd / minor 6th
					case 8:
					inverted = true;
					case 4:
					ratio = 5/4;
					break;

					//minor 3rd - only do the 7/6 one, not the wonky 8/7 one.
					case 9:
					inverted = true;
					case 3:
					ratio = 7/6;
					break;
				}

				if (inverted) {
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

			}
		}
		updateDisplay();
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

		//we need the list of notes sorted by frequency
		var sortedNotes = Object.keys(notes).sort(function(a,b){return notes[b]-notes[a]});

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


	function addRule(note1, note2, fraction, comma, id) {
		//adds the data to the rules list and returns the id of the rule

		if (id) {
			//replace the existing rule
			ruleList[id]={note1: note1, note2: note2, fraction:fraction, comma:comma};
			return id;
		}
		else {
			//if id is 0, it's a new id
			//push the data into the list
			ruleList.push({note1: note1, note2: note2, fraction:fraction, comma:comma});
			return ruleList.length-1;
		}

	}

	function disableInputs(element) {
		//disable all the input boxes inside an element
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
		var inputs = element.getElementsByTagName("input");
		var i;
		for (i=0; i<inputs.length; i++) {
			if (inputs[i].type == "text") inputs[i].disabled=true;
		}
		var select = element.getElementsByTagName("select");
		if (select[0]) select[0].disabled=true;
	}

	function disableButtons() {
		//when editing a rule, disable the edit buttons and new rule button
		document.getElementById('newRule').disabled=true;
		var i;
		editButtons=document.getElementsByClassName('editRuleButton');
		for (i = 0; i < editButtons.length; i++) {
			editButtons[i].disabled=true;
		}
	}

	function enableButtons() {
		//re-enable edit buttons and new rule button when finished editing rule
		document.getElementById('newRule').disabled=false;
		var i;
		editButtons=document.getElementsByClassName('editRuleButton');
		for (i = 0; i < editButtons.length; i++) {
			editButtons[i].disabled=false;
		}
	}

	function checkRule(note1, note2, fraction, comma) {
		//check the three rule parts. Return 0 if everything is good. An integer if it's duplicating an existing one, or -1 if it can't parse it.
		//TODO
		return(0);
	}


	//play note


}






