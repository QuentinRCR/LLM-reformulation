// Requirements: Don't use markdown

document.addEventListener('DOMContentLoaded', () => {
    const inputBox = document.querySelector('.input_box');
    const editableBox =   document.querySelector('.editable');
    const liveBox = document.querySelector('.live');
    const reformulateBtn = document.querySelector('.reformulate');
    const cancelBtn = document.querySelector('.cancel');
    const toggleEditBtw = document.querySelector('.toggle_edit');
    const copyTextBtw = document.querySelector('.copy_text');

  
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

    toggleEditBtw.addEventListener('click', ()=>{
      const is_editable = (editableBox.getAttribute("contenteditable")=="true")
      editableBox.setAttribute("contenteditable",!is_editable)
      toggleEditBtw.setAttribute("src",is_editable ? "icons/edit.png" : "icons/noEdit.png")
    })

    copyTextBtw.addEventListener('click', async ()=>{
        // get the text to copy
        const text_to_copy = (editedResponse+liveResponse).replaceAll('</br>','\n');

        // copy it
        navigator.clipboard.writeText(text_to_copy);
        
        // replace the copy icon with a check to show that is copied the text
        copyTextBtw.setAttribute('src','icons/check.png');
        await new Promise(x => setTimeout(x,700));
        copyTextBtw.setAttribute('src','icons/copy.png');
      }
    )

    async function get_chunk(reader,decoder){
      const { value } = await reader.read();
      const chunk = JSON.parse(decoder.decode(value, { stream: true }));

      // Replace newline characters with <br>
      chunk.response = chunk.response.replaceAll('\n','</br>')

      return [chunk.done,chunk.response]
    }

    // Update the editing element to add the content of the text that was generated in the meantime 
    function transfer_from_live_to_editing(){
        editedResponse = editableBox.innerHTML + liveResponse
        editableBox.innerHTML = editedResponse
        liveResponse = ''
        liveBox.innerHTML = liveResponse
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
        let chuck_text = '';
  
        editedResponse = '';
        liveResponse = '';
        editableBox.textContent = editedResponse; //reset box
        liveBox.textContent = liveResponse;
        let previousEditing = editing;
  
        while (!done) { //stream the response
          [done, chuck_text] = (await get_chunk(reader,decoder))

          // if it was in editing mode and it's not the case anymore, put the content
          // of the live element in the editing element
          if (previousEditing && !editing){
            transfer_from_live_to_editing();
          }
          previousEditing = editing;
  
          // add the generated text to the correct div
          if (!editing) {
            editedResponse += chuck_text;
            editableBox.innerHTML = editedResponse;
          } else {
            liveResponse += chuck_text;
            liveBox.innerHTML = liveResponse;
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
  