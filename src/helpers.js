// Find the first element in list that contains str or is contained in str (case insensitive)
function findIntersecting(list, str) {
    return list.find(el => el.toLowerCase().includes(str.toLowerCase()) || str.toLowerCase().includes(el.toLowerCase()));
}

// For our purposes, a valid date string
// is a string that contains at least year-month-day
// and can be parsed into a valid date object
// This is so we can mix dates and offsets
// when we sort and plot the dose table.
function isValidDateString(dateString) {
    if (typeof dateString !== 'string') {
        return false;
    }
    let date = new Date(dateString);
    if (isNaN(date)) {
        return false;
    }
    let dateParts = dateString.split('-');
    return dateParts.length >= 3;
}

function findEarliestDate(dates) {
    return dates.reduce((earliest, current) => {
        let current_date = isNaN(current) ? new Date(current) : new Date(earliest.getTime() + current * 24 * 60 * 60 * 1000);
        return current_date < earliest ? current_date : earliest;
    }, new Date());
}

function transformToDayOffets(dates) {
    let earliestDate = findEarliestDate(dates);
    return dates.map(date => {
        if (!isValidDateString(date)) {
            return date;
        }
        let currentDate = new Date(date);
        let differenceInTime = currentDate.getTime() - earliestDate.getTime();
        return differenceInTime / (1000 * 3600 * 24);  // Convert milliseconds to days
    });
}

function sortDatesAndOffsets(dates) {
    let offsets = transformToDayOffets(dates);
    return dates
        .map((date, index) => ({ date, offset: offsets[index] }))
        .sort((a, b) => a.offset - b.offset)
        .map(item => item.date);
}

function getMonospaceWidth() {
    let element = document.createElement('pre');
    element.style.position = 'absolute';
    element.style.left = '-9999px';
    element.style.fontFamily = 'monospace';
    element.textContent = '_';  // 'm' is often used because it's wide
    document.body.appendChild(element);

    // Measure the width of a single monospace character
    let charWidth = element.getBoundingClientRect().width;

    // Remove the off-screen element
    document.body.removeChild(element);

    regionWidth = document.getElementById('e2d3-plot').clientWidth;

    // Calculate and log the width of the window in monospace characters

    return Math.floor(regionWidth / charWidth);

}


function numberToDayHour(number, precision = 0) {
    let days = Math.floor(number);
    let hours = (Math.round((number - days) * 24)).toFixed(precision);
    return `${days}d ${hours}h`;
}

function convertCustomCSSVarToRGBA(varName, alpha = 1.0) {
    let rootStyle = getComputedStyle(document.documentElement);
    let color = rootStyle.getPropertyValue(varName)
    let rgb = '';
    if (color.startsWith('#')) {
        rgb = color
        let r = parseInt(rgb.slice(1, 3), 16);
        let g = parseInt(rgb.slice(3, 5), 16);
        let b = parseInt(rgb.slice(5, 7), 16);
        rgb = `${r}, ${g}, ${b}`;
    } else {
        rgb = color.substring(4, color.length - 1);
    }
    return `rgba(${rgb}, ${alpha})`
}

function colorTheBlue(alpha = 1.0) { return convertCustomCSSVarToRGBA('--the-blue', alpha) }
function colorThePink(alpha = 1.0) { return convertCustomCSSVarToRGBA('--the-pink', alpha) }
function colorBackground(alpha = 1.0) { return convertCustomCSSVarToRGBA('--background-color', alpha) }
function colorStandout(alpha = 1.0) { return convertCustomCSSVarToRGBA('--standout-color', alpha) }

function setColorScheme(scheme = 'night') {
    let rootStyle = getComputedStyle(document.documentElement);
    if (scheme == 'night') {
        document.documentElement.style.setProperty('--background-color', rootStyle.getPropertyValue('--background-color-night'));
        document.documentElement.style.setProperty('--standout-color', rootStyle.getPropertyValue('--standout-color-night'));
        document.documentElement.style.setProperty('--the-blue', rootStyle.getPropertyValue('--the-blue-night'));
        document.documentElement.style.setProperty('--the-pink', rootStyle.getPropertyValue('--the-pink-night'));
    } else if (scheme == 'day') {
        document.documentElement.style.setProperty('--background-color', rootStyle.getPropertyValue('--background-color-day'));
        document.documentElement.style.setProperty('--standout-color', rootStyle.getPropertyValue('--standout-color-day'));
        document.documentElement.style.setProperty('--the-blue', rootStyle.getPropertyValue('--the-blue-day'));
        document.documentElement.style.setProperty('--the-pink', rootStyle.getPropertyValue('--the-pink-day'));
    }
    refresh();
}


function unitStep(x) {
    if (x < 0) {
        return 0;
    } else if (x >= 0) {
        return 1;
    }
}

function loadCSV(files) {
    if (files.length > 0) {
        let file = files[0];
        let reader = new FileReader();

        reader.onload = function (event) {
            Papa.parse(event.target.result, {
                complete: function (results) {
                    deleteAllRows('dose-table');
                    results.data.forEach(function (csvrow) {
                        if (csvrow.length >= 3) {
                            let ester = findIntersecting(esterList, csvrow[2].replace(/\s/g, '').replace(/im/gi, ''));

                            if (ester && (isFinite(csvrow[0]) || isValidDate(csvrow[0])) && isFinite(csvrow[1])) {
                                addTDERow('dose-table', csvrow[0], parseFloat(csvrow[1]), ester)
                            }
                        }
                    });
                    refresh();
                }
            });
        };

        reader.readAsText(file);
    }
}

function exportCSV() {
    let table = document.getElementById('dose-table');
    let rows = Array.from(table.rows);
    let data = [['time (days)', 'dose (mg)', 'ester']].concat(rows.slice(1).map(row => {
        let timeValue = row.cells[2].querySelector('input').value;
        let doseValue = row.cells[3].querySelector('input').value;
        let esterValue = row.cells[4].querySelector('select').value;
        return [timeValue, doseValue, esterValue];
    }));
    let csvContent = Papa.unparse(data);

    let downloadLink = document.createElement('a');
    downloadLink.href = 'data:text/csv;charset=utf-8,' + encodeURI(csvContent);
    downloadLink.download = 'dose-table.csv';

    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
}


function readRow(row, keepincomplete = false) {

    let time = row.cells[2].querySelector('input').value;
    let dose = row.cells[3].querySelector('input').value;
    let ester = row.cells[4].querySelector('select').value;

    let cv = row.cells[0].querySelector('input');
    let cvisibility = cv ? cv.checked : null;
    let uv = row.cells[1].querySelector('input');
    let uvisibility = uv ? uv.checked : null;

    if ((!isNaN(parseFloat(time)) && !isNaN(parseFloat(dose)) && dose > 0) || keepincomplete) {
        return { time: time, dose: dose, ester: ester, cvisibility: cvisibility, uvisibility: uvisibility };
    } else {
        return null;
    }
}

function getTDEs(tableId, getvisibility = false, keepincomplete = false) {
    let doseTable = document.getElementById(tableId);
    let times = [];
    let doses = [];
    let esters = [];

    let cvisibilities = [];
    let uvisibilities = [];

    for (let i = 1; i < doseTable.rows.length; i++) {
        let row = doseTable.rows[i];
        let rowdata = readRow(row, keepincomplete);
        if (rowdata) {
            times.push(rowdata.time);
            doses.push(rowdata.dose);
            esters.push(rowdata.ester);
            if (getvisibility) {
                cvisibilities.push(rowdata.cvisibility);
                uvisibilities.push(rowdata.uvisibility);
            }
        }
    };

    if (getvisibility) {
        return [times, doses, esters, cvisibilities, uvisibilities];
    } else {
        return [times, doses, esters]
    };

}

function addTDERow(id, time = null, dose = null, ester = null, cvisible = true, uvisible = true, stationaryclick = false) {

    console.log('adding row', id, time, dose, ester, cvisible, uvisible, stationaryclick);

    let table = document.getElementById(id);
    let row = table.insertRow(-1);

    rowValidity.set(row, false);

    // -----------------------------------------
    // Add visibility and uncertainty checkboxes
    let visibilityCell = row.insertCell(0);
    visibilityCell.className = 'visibility-cell';
    visibilityCell.width = '1.7em';
    visibilityCell.height = '1.7em';

    if (id == 'steadystate-table' || ((id == 'dose-table') && (table.rows.length == 2))) {
        let visibilityCheckbox = document.createElement('input');
        visibilityCheckbox.type = 'checkbox';
        visibilityCheckbox.className = 'hidden-checkbox checked-style';
        visibilityCheckbox.checked = cvisible;
        visibilityCell.appendChild(visibilityCheckbox);

        let visibilityCustomCheckbox = document.createElement('div');
        visibilityCustomCheckbox.className = visibilityCheckbox.checked ? 'custom-checkbox checked-style' : 'custom-checkbox';
        visibilityCustomCheckbox.onclick = function () {
            visibilityCheckbox.checked = !visibilityCheckbox.checked;
            this.className = visibilityCheckbox.checked ? 'custom-checkbox checked-style' : 'custom-checkbox';
            if (readRow(this.parentElement.parentElement)) {
                refresh()
            }
        };
        visibilityCell.appendChild(visibilityCustomCheckbox);
    }
    let uncertaintyCell = row.insertCell(1);
    uncertaintyCell.className = 'uncertainty-cell';
    uncertaintyCell.width = '1.7em';
    uncertaintyCell.height = '1.7em';

    if (id == 'steadystate-table' || ((id == 'dose-table') && (table.rows.length == 2))) {

        let uncertaintyCheckbox = document.createElement('input');
        uncertaintyCheckbox.type = 'checkbox';
        uncertaintyCheckbox.className = 'hidden-checkbox checked-style';
        uncertaintyCheckbox.checked = uvisible;
        uncertaintyCell.appendChild(uncertaintyCheckbox);

        let uncertaintyCustomCheckbox = document.createElement('div');
        uncertaintyCustomCheckbox.className = uncertaintyCheckbox.checked ? 'custom-checkbox checked-style' : 'custom-checkbox';
        uncertaintyCustomCheckbox.onclick = function () {
            uncertaintyCheckbox.checked = !uncertaintyCheckbox.checked;
            this.className = uncertaintyCheckbox.checked ? 'custom-checkbox checked-style' : 'custom-checkbox';
            if (readRow(this.parentElement.parentElement)) {
                refresh()
            }
        };
        uncertaintyCell.appendChild(uncertaintyCustomCheckbox);
    }

    // -----------------------------------------


    let timeCell = row.insertCell(2)
    timeCell.innerHTML = '<input type="text" class="flat-input time-cell">';
    if (time !== null) {
        timeCell.querySelector('input').value = time;
    }
    timeCell.querySelector('input').addEventListener('input', function () {
        let myRow = this.parentElement.parentElement;
        let currentValidity = Boolean(readRow(myRow, false));

        if ((currentValidity !== rowValidity.get(myRow)) || currentValidity) {
            rowValidity.set(myRow, currentValidity);
            refresh()
        }
    });

    // timeCell.addClassName = "time-cell";


    let doseCell = row.insertCell(3)
    doseCell.innerHTML = '<input type="text" class="flat-input dose-cell">';
    if (dose !== null) {
        doseCell.querySelector('input').value = dose;
    }
    doseCell.querySelector('input').addEventListener('input', function () {
        
        let myRow = this.parentElement.parentElement;
        let currentValidity = Boolean(readRow(myRow, false));

        if ((currentValidity !== rowValidity.get(myRow)) || currentValidity) {
            rowValidity.set(myRow, currentValidity);
            refresh()
        }

    });

    // doseCell.addClassName = "dose-cell";

    let esterCell = row.insertCell(4)
    esterCell.innerHTML =
        '<select class="dropdown-ester"> \
            <option value="EV IM">EV IM</option> \
            <option value="EEn IM">EEn IM</option> \
            <option value="EC IM">EC IM</option> \
            <option value="EB IM">EB IM</option> \
            <option value="EUn IM">EUn IM</option> \
            </select>';
    if (ester !== null) {
        esterCell.querySelector('select').value = ester;
    }
    esterCell.querySelector('select').addEventListener('change',  function () {
        if (readRow(this.parentElement.parentElement)) {
            refresh()
        }
    });

    let deleteCell = row.insertCell(5);
    deleteCell.innerHTML = '<button class="flat-button delete-button">-</button>';
    deleteCell.querySelector('.delete-button').addEventListener('click', function () {
        rowValidity.delete(this.parentNode.parentNode);
        this.parentNode.parentNode.remove();
        refresh();
    });

    if (stationaryclick) {
        document.getElementById('add-dose-button').scrollIntoView();
    }

    return row;
}

function deleteAllRows(id) {
    let table = document.getElementById(id);
    while (table.rows.length > 1) {
        rowValidity.delete(table.rows[table.rows.length - 1]);
        table.deleteRow(-1);
    }
}

function attachDragNDropImport() {

    let doseTable = document.getElementById('dragndrop-zone');
    doseTable.addEventListener('dragenter', function (event) {
        doseTable.classList.add('overlay');
    });

    doseTable.addEventListener('dragleave', function (event) {
        if (event.relatedTarget === null || !doseTable.contains(event.relatedTarget)) {
            doseTable.classList.remove('overlay');
        }
    });

    doseTable.addEventListener('dragover', function (event) {
        event.preventDefault();
    });

    doseTable.addEventListener('drop', function (event) {
        event.preventDefault();
        doseTable.classList.remove('overlay');
        let files = event.dataTransfer.files;
        loadCSV(files)
    });

}

function changeBackgroundColor(elementId, color1, color2, delay = 100) {
    let element = document.getElementById(elementId);
    element.style.backgroundColor = color1;

    setTimeout(function () {
        element.style.backgroundColor = color2;
    }, delay);
}

function attachMultidoseButtonsEvents() {
    document.getElementById('add-dose-button').addEventListener('click', function () {
        addTDERow('dose-table');
    });
    document.getElementById('delete-all-doses-button').addEventListener('click', function () {
        deleteAllRows('dose-table');
        refresh();
        addTDERow('dose-table');
    });
    document.getElementById('save-button').addEventListener('click', function () {
        saveToLocalStorage();
    });
    document.getElementById('load-button').addEventListener('click', function () {
        loadFromLocalStorage();
        refresh();
    });
    document.getElementById('save-csv-button').addEventListener('click', function () {
        exportCSV();
    });
    document.getElementById('import-csv-dialog').addEventListener('click', function () {
        document.getElementById('csv-file').click();
    });
    document.getElementById('csv-file').addEventListener('change', function (e) {
        loadCSV(e.target.files);
    });
}

function attachSteadyStateButtonsEvents() {
    document.getElementById('add-steadystate-button').addEventListener('click', function () {
        addTDERow('steadystate-table');
    });
    document.getElementById('delete-all-steadystates-button').addEventListener('click', function () {
        deleteAllRows('steadystate-table');
        refresh();
        addTDERow('steadystate-table');
    });
}

function themeSetup() {

    let currentHour = new Date().getHours();

    if (currentHour >= 6 && currentHour < 18) {
        document.getElementById('themeSwitch').checked = true;
        setColorScheme('day');
    } else {
        document.getElementById('themeSwitch').checked = false;
        setColorScheme('night');
    }

    document.getElementById('themeSwitch').addEventListener('change', function (event) {
        if (event.target.checked) {
            setColorScheme('day');
        } else {
            setColorScheme('night');
        }
    });

}

function tipJarEvent() {
    document.getElementById('copy-xmr').addEventListener('click', function () {
        navigator.clipboard.writeText(this.innerText);
        changeBackgroundColor('copy-xmr', colorThePink(), null, 150);
    });
}

function saveToLocalStorage() {
    let multiDoseTable = getTDEs('dose-table', true, true);
    let steadyStateTable = getTDEs('steadystate-table', true, true);

    console.log('\n');

    console.log('saving md', multiDoseTable);
    localStorage.setItem('multiDoseTable', JSON.stringify(multiDoseTable));

    console.log('saving ss', steadyStateTable);
    localStorage.setItem('steadyStateTable', JSON.stringify(steadyStateTable));
}

function loadFromLocalStorage() {
    let multiDoseTable = JSON.parse(localStorage.getItem('multiDoseTable'));
    let steadyStateTable = JSON.parse(localStorage.getItem('steadyStateTable'));

    console.log('\n');
    console.log('loaded md', multiDoseTable);
    console.log('loaded ss', steadyStateTable);

    if (multiDoseTable) {
        deleteAllRows('dose-table');
        for (let i = 0; i < multiDoseTable[0].length; i++) {
            addTDERow('dose-table', multiDoseTable[0][i], multiDoseTable[1][i], multiDoseTable[2][i], multiDoseTable[3][i], multiDoseTable[4][i]);
        }
    }

    if (steadyStateTable) {
        deleteAllRows('steadystate-table');
        for (let i = 0; i < steadyStateTable[0].length; i++) {
            addTDERow('steadystate-table', steadyStateTable[0][i], steadyStateTable[1][i], steadyStateTable[2][i], steadyStateTable[3][i], steadyStateTable[4][i]);
        }
    }
}