/**
 * Centralized prompts for diagnosis API
 */

export const PLANT_IDENTIFICATION_PROMPT = `
Identify the plant in the provided image(s). Only reply with the plant name, nothing else. 
Use the name that an average person familiar with plants would use.
E.g., for Monstera Deliciosa, reply 'Monstera Deliciosa' and not 'Swiss Cheese Plant', since the scientific name is commonly known.
However, for a plant with an unknown scientific name and a well-known common name, use the common name.
If no plant is detected, or there are clearly multiple plants on the pictures, or the plant name cannot be identified with high certainty, reply with a blank string ''.
`;

export const YES_NO_QUESTIONS = `
Have you watered the plant in the last 5 days?
Does the soil feel soggy or waterlogged?
Is the plant receiving direct sunlight?
Is the plant in a dark corner far away from a window?
Is the plant near a bright window?
Has the plant been moved to a different location recently?
Are you using artificial grow lights?
Is the plant near a heating or cooling vent?
Has there been a significant temperature change recently?
Is the air in the room very dry?
Do you use a humidifier near the plant?
Have you fertilized the plant in the last month?
Are you using a specific fertilizer for this type of plant?
Has the plant been repotted in the last 6 months?
Is the plant in the same soil it came with when purchased?
Have you noticed any small insects on or around the plant?
Are there any sticky substances on the leaves?
Do you see any webbing on the plant?
Have you treated the plant with any pesticides recently?
Do you clean the leaves regularly?
Have you introduced any new plants to this area recently?
Do you notice any unusual odors coming from the soil or plant?
Did the symptoms start after a recent watering schedule change?
Did the yellowing start from the oldest leaves first?
Do the affected leaves feel soft or mushy when touched?
Does the plant feel lighter than usual when you lift the pot?
Has the plant stopped producing new growth?
Is this a newly purchased plant (less than 2 months)?
Have you changed your care routine recently?
Was the plant healthy before the current symptoms appeared?
Have other plants in the same area shown similar symptoms?
Is there good air circulation around the plant?
Do you check the soil moisture before watering?
Are there leaves dropping from the plant?
Is the stem or base of the plant discolored or soft?
Are there signs of mold or fungus on the soil surface?
Are the flowers or buds wilting or failing to open?
Are the roots sticking out through the holes at the bottom of the pot?
Have you noticed any sticky residue on nearby surfaces?
Is the plant exposed to a draft?
Is the plant in a self-watering pot or system?
Is the plant in a chunky, well draining soil?
Is there a history of pest infestations in your home?
When you water the plant, do you make sure to saturate the soil fully?
Is the plant often standing in water after watering?
Has the plant experienced any recent changes in watering frequency?
Do you notice any mineral buildup on the soil or pot?
Has the plant ever been exposed to freezing temperatures?
Is the plant in a pot with drainage holes?
Do you ever forget to water the plant for an extended period of time?
Do you water the plant frequently, but always giving just a small amount of water?
Do you check if the soil is still wet before you water?
Is your watering very irregular?
`;

export const QUESTIONS_GENERATION_PROMPT_old = `
You are an expert botanist. The user has given you image(s) of a sick plant for diagnosis. 
You have the chance to ask the user some clarifying yes/no questions that could help you narrow down your diagnosis and differentiate between different diagnoses that might appear similar visually. 
You can choose between 3-5 questions from the following list of questions:

${YES_NO_QUESTIONS}

Here is a list of example questions of the type that might make sense to ask, but you are not limited to these:

${YES_NO_QUESTIONS}

Study the images closely and think about what questions would be helpful to ask to differentiate between possible diagnoses. 
Ask about aspects which are not easily inferred from the image. You may also come up with a question that is not on the list if needed, but make sure it is a yes/no question. 
Make sure each question is unique.

Please answer using the 'generate_questions' function call.
`;

export const QUESTIONS_GENERATION_PROMPT = `
You are an expert botanist. The user has given you image(s) of a sick plant for diagnosis. 
You have the chance to ask the user some clarifying yes/no questions that could help you narrow down your diagnosis and differentiate between different diagnoses that might appear similar visually. 

Study the images closely and think about what questions would be helpful to ask to differentiate between possible diagnoses. 
Ask specifically about aspects which are not easily inferred from the images. Come up with 3 - 5 yes/no questions. 
Make sure each question is unique and can be answered with a simple 'yes' or 'no'.

Please answer using the 'generate_questions' function call.
`;

export const createInitialDiagnosisPrompt = (questionsAndAnswers: string): string => `
You are an expert botanist. Based on the images and context, what are the most likely possible diagnoses for the plant's issue? Provide up to three diagnoses if multiple options seem likely.
Only reply with the concrete diagnosis names, separated by commas, and nothing else. Inspect the images very closely for any signs of early issues, such as pest activity. 
If you can't find any issues with the plant, respond with 'No bugs identified'. If no plant appears in the images, respond with 'No plant detected'.
User provided questions and answers: ${questionsAndAnswers}
`;

export const createAggregationPrompt = (diagnosisResults: string[]): string => `
You are an expert plant pathologist. I have collected these plant diagnosis suggestions from multiple experts:
${diagnosisResults.join('\n')}

Please group similar diagnoses together and rank them by frequency/consensus. 
Output ONLY a ranked list of the most likely diagnoses, most frequent first, comma-separated.
Remove duplicates and group similar conditions together.
Limit to maximum 5 diagnoses.

Example output: "Root rot, Spider mites, Nitrogen deficiency"
`;

export const createFinalDiagnosisPrompt = (questionsAndAnswers: string, rankedDiagnoses: string): string => `
You are an expert botanist and plant pathologist specializing in diagnosing plant issues from images.
Your answers should be concise, clear, and actionable.
You rate your confidence in your diagnosis realistically given the available information.
In your response, refer to the user as 'you' and NOT as 'the user'.

You also include subtle funny computer science references in your responses. Don't make it too obvious, but make subtle references that a programmer would understand. 
Avoid using quotation marks and starting sentences with 'think of it as' or 'this/it is like'.

The user has provided image(s) and answered some questions about their plant:
${questionsAndAnswers}

Treat the image(s) as the primary source of information. Inspect them very closely for any signs of early pest activity. 
Consider also the rest of the user's input if provided, but treat it as a starting point rather than the sole basis for your diagnosis.

The following diagnoses were ranked by frequency by other plant experts: ${rankedDiagnoses}.
Consider this ranked list in your answer. Do not mention the other experts and their diagnoses in your response.

Please provide a diagnosis using the 'plant_diagnosis' function call.
`;
