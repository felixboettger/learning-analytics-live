[surveyURL, id, goodbyeText] = getCookieValues()
surveyURL = surveyURL.slice(10)

function getCookieValues() {
  const cookieValues = document.cookie.split('; ');
  const surveyURL = cookieValues.find(row => row.startsWith('surveyurl='));
  const goodbyeText = cookieValues.find(row => row.startsWith('goodbyetext=')).split("=")[1];
  const id = cookieValues.find(row => row.startsWith('participantId=')).split('=')[1];
  return [surveyURL, id, goodbyeText];
};

if (goodbyeText != "undefined"){
  document.getElementById("goodbye-text").innerHTML = goodbyeText + " Please write down your participant-id as we will ask you for it in the survey! Your participant-id is: " + id;
} else {
  document.getElementById("goodbye-text").innerHTML = "Please write down your participant-id as we will ask you for it in the survey! Your participant-id is: " + id;
}

if (surveyURL != "undefined"){
  document.getElementById("survey-url").innerHTML = "Please fill out our survey: <a href=" + surveyURL + ">Open Survey</a>"
} else {
  document.getElementById("survey-url").remove()
}