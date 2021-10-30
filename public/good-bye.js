[surveyURL, id, goodbyeText] = getCookieValues()
surveyURL += id
surveyURL = surveyURL.slice(10)

function getCookieValues() {
  const cookieValues = document.cookie.split('; ');
  const surveyURL = cookieValues.find(row => row.startsWith('surveyurl='));
  const goodbyeText = cookieValues.find(row => row.startsWith('goodbyetext='));
  const id = cookieValues.find(row => row.startsWith('participantId=')).split('=')[1];
  return [surveyURL, id, goodbyeText];
};

if (goodbyeText != undefined){

document.getElementById("goodbye-text").innerHTML = goodbyeText
}

if (surveyURL != undefined){
  document.getElementById("survey-url").innerHTML = surveyURL
}


iframe = document.getElementById("iframe-survey")

iframe.setAttribute("src", surveyURL)

console.log(surveyURL)