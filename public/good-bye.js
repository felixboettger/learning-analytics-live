[surveyURL, id, goodbyeText] = getCookieValues()
surveyURL += id
surveyURL = surveyURL.slice(10)
// Investigate where trailing 0 comes from!
surveyURL = surveyURL.substring(0, surveyURL.length -1)

function getCookieValues() {
  const cookieValues = document.cookie.split('; ');
  const surveyURL = cookieValues.find(row => row.startsWith('surveyurl='));
  const goodbyeText = cookieValues.find(row => row.startsWith('goodbyetext=')).split("=")[1];
  const id = cookieValues.find(row => row.startsWith('participantId=')).split('=')[1];
  return [surveyURL, id, goodbyeText];
};

if (goodbyeText != "undefined"){
document.getElementById("goodbye-text").innerHTML = goodbyeText
}

if (surveyURL != "undefined"){
  document.getElementById("survey-url").innerHTML = "Please fill out our survey: <a href=" + surveyURL + ">Open Survey</a>"
} else {
  document.getElementById("survey-url").remove()
  document.getElementById("iframe-survey").remove()
}