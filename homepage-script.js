document.addEventListener('DOMContentLoaded', () => {
  const enterChatbotBtn = document.getElementById('enter-chatbot-btn');
  const liveChatBtn = document.getElementById('live-chat-btn');
  
  // Handle Enter Chatbot button
  enterChatbotBtn.addEventListener('click', () => {
    // Redirect to the chatbot page
    window.location.href = 'chatbot.html';
  });
  
  // Handle Live Chat button
  liveChatBtn.addEventListener('click', () => {
    // Show loading message
    showNotification('Connecting to live support...');
    
    // Check if Tawk_API is loaded
    if (typeof Tawk_API !== 'undefined' && Tawk_API.maximize) {
      // Tawk.to is loaded, open the chat
      setTimeout(() => {
        Tawk_API.maximize();
      }, 500);
    } else {
      // Tawk.to is not loaded yet, wait and try again
      let attempts = 0;
      const checkInterval = setInterval(() => {
        attempts++;
        if (typeof Tawk_API !== 'undefined' && Tawk_API.maximize) {
          clearInterval(checkInterval);
          Tawk_API.maximize();
        } else if (attempts > 10) {
          clearInterval(checkInterval);
          showNotification('Sorry, live chat is currently unavailable. Please try again later.');
        }
      }, 500);
    }
  });
  
  // Function to show notification
  function showNotification(message) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    
    // Style the notification
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background-color: #333;
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 1000;
      font-size: 14px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }
});