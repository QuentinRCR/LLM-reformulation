document.addEventListener('DOMContentLoaded', () => {
    const inputBox = document.querySelector('.input_box');
    const editableBox = document.querySelector('.editable');
    const liveBox = document.querySelector('.live');
    const reformulateBtn = document.querySelector('.reformulate');
    const cancelBtn = document.querySelector('.cancel');
  
    let content = '';
    let editedResponse = '';
    let liveResponse = '';
    let controller = null;
    let editing = false;
  
    editableBox.addEventListener('focus', () => { //toggle editing mode when the edit element is focused
      editing = true;
    });
  
    editableBox.addEventListener('blur', () => {
      editing = false;
      if(!controller){ // if no text is currently generated
        transfer_from_live_to_editing() //put everything back in the editable div
      }
    });
  
    reformulateBtn.addEventListener('click', (e) => {
      e.preventDefault();
      queryLLM(inputBox.innerHTML);
    });
  
    cancelBtn.addEventListener('click', () => {
      if (controller) controller.abort();
    });

    // Update the editing element to add the content of the text that was generated in the meantime 
    function transfer_from_live_to_editing(){
        editedResponse = editableBox.innerHTML + liveResponse
        editableBox.innerHTML = editedResponse
        liveResponse = ''
        liveBox.textContent = liveResponse
    }
  
    async function queryLLM(prompt, model = "llama3:latest") {
      const API_ENDPOINT = "http://localhost:11434/api/generate";
      const abortController = new AbortController();
      controller = abortController;
  
      try {
        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model, prompt, stream: true }),
          signal: abortController.signal
        });
  
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
  
        editedResponse = '';
        liveResponse = '';
        editableBox.innerHTML = editedResponse; //reset box
        liveBox.textContent = liveResponse;
        let previousEditing = editing;
  
        while (!done) { //stream the response
          const { value } = await reader.read();
          const chunk = JSON.parse(decoder.decode(value, { stream: true }));
          done = chunk.done;

          // if it was in editing mode and it's not the case anymore, put the content
          // of the live element in the editing element
          if (previousEditing && !editing){
            transfer_from_live_to_editing();
          }
          previousEditing = editing;
  
          // add the generated text to the correct div
          if (!editing) {
            editedResponse += chunk.response;
            editableBox.innerHTML = editedResponse;
          } else {
            liveResponse += chunk.response;
            liveBox.textContent = liveResponse;
          }
        }
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error("Error querying Llama3:", error);
          editedResponse = "Error querying Llama3";
          editableBox.innerHTML = editedResponse;
        }
      } finally {
        controller = null;
      }
    }
  });
  