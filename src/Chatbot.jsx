import React, { useState, useRef, useEffect } from 'react';

const Chatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { text: userMessage, sender: 'user' }]);
    setIsLoading(true);

    try {
      console.log('Sending message to API:', userMessage);
      
      // Using relative URL since both frontend and API are on the same server
      const response = await fetch('../api/chat.php', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: userMessage }),
      });

      console.log('Response status:', response.status);
      console.log('Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Server error response:', errorText);
        throw new Error(`Server error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      console.log('API response data:', data);
      setMessages(prev => [...prev, { text: data.answer || 'Sorry, I couldn\'t process your request.', sender: 'bot' }]);
    } catch (error) {
      console.error('Error sending message:', error);
      
      // More detailed error message based on the error type
      let errorMessage = 'Sorry, there was an error processing your request. Please try again.';
      
      if (error.message.includes('Server error: 500')) {
        errorMessage = 'The server is experiencing issues. Please try again later or contact support.';
      } else if (error.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to the server. Please check your internet connection.';
      } else if (error.message.includes('JSON')) {
        errorMessage = 'The server returned an invalid response. Please try again.';
      }
      
      setMessages(prev => [...prev, { text: errorMessage, sender: 'bot' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };


  return (
    <div className="chatbot-container">
      {/* Chat Button */}
      <button 
        className="chatbot-button"
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Open chat"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2ZM20 16H5.17L4 17.17V4H20V16Z" fill="currentColor"/>
        </svg>
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <h3>VAST Assistant</h3>
            <button 
              className="close-button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
            >
              ×
            </button>
          </div>
          
          <div className="chatbot-messages">
            {messages.length === 0 && (
              <div className="welcome-message">
                <p>👋 Hello! I'm your VAST assistant. How can I help you today?</p>
              </div>
            )}
            
            {messages.map((message, index) => (
              <div key={index} className={`message ${message.sender}`}>
                <div className="message-content">
                  {message.text}
                </div>
              </div>
            ))}
            
            {isLoading && (
              <div className="message bot">
                <div className="message-content">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>
          
          <div className="chatbot-input">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              rows="1"
              disabled={isLoading}
            />
            <button 
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className="send-button"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2.01 21L23 12 2.01 3 2 10L17 12L2 14L2.01 21Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .chatbot-container {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 1000;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }

        .chatbot-button {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .chatbot-button:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2);
        }

        .chatbot-window {
          position: absolute;
          bottom: 80px;
          right: 0;
          width: 350px;
          height: 500px;
          background: white;
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid #e1e5e9;
        }

        .chatbot-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .chatbot-header h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 600;
        }

        .close-button {
          background: none;
          border: none;
          color: white;
          font-size: 24px;
          cursor: pointer;
          padding: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 50%;
          transition: background-color 0.2s ease;
        }

        .close-button:hover {
          background-color: rgba(255, 255, 255, 0.2);
        }

        .chatbot-messages {
          flex: 1;
          padding: 16px;
          overflow-y: auto;
          background: #f8f9fa;
        }

        .welcome-message {
          text-align: center;
          color: #6c757d;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .message {
          margin-bottom: 12px;
          display: flex;
        }

        .message.user {
          justify-content: flex-end;
        }

        .message.bot {
          justify-content: flex-start;
        }

        .message-content {
          max-width: 80%;
          padding: 12px 16px;
          border-radius: 18px;
          font-size: 14px;
          line-height: 1.4;
          word-wrap: break-word;
        }

        .message.user .message-content {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-bottom-right-radius: 4px;
        }

        .message.bot .message-content {
          background: white;
          color: #333;
          border: 1px solid #e1e5e9;
          border-bottom-left-radius: 4px;
        }

        .chatbot-input {
          padding: 16px;
          background: white;
          border-top: 1px solid #e1e5e9;
          display: flex;
          align-items: flex-end;
          gap: 8px;
        }

        .chatbot-input textarea {
          flex: 1;
          border: 1px solid #e1e5e9;
          border-radius: 20px;
          padding: 12px 16px;
          font-size: 14px;
          resize: none;
          outline: none;
          font-family: inherit;
          line-height: 1.4;
          max-height: 100px;
          min-height: 20px;
        }

        .chatbot-input textarea:focus {
          border-color: #667eea;
        }

        .send-button {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          border: none;
          color: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          flex-shrink: 0;
        }

        .send-button:hover:not(:disabled) {
          transform: scale(1.05);
        }

        .send-button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .typing-indicator {
          display: flex;
          gap: 4px;
          align-items: center;
        }

        .typing-indicator span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #667eea;
          animation: typing 1.4s infinite ease-in-out;
        }

        .typing-indicator span:nth-child(1) {
          animation-delay: -0.32s;
        }

        .typing-indicator span:nth-child(2) {
          animation-delay: -0.16s;
        }

        @keyframes typing {
          0%, 80%, 100% {
            transform: scale(0.8);
            opacity: 0.5;
          }
          40% {
            transform: scale(1);
            opacity: 1;
          }
        }

        /* Responsive design */
        @media (max-width: 480px) {
          .chatbot-window {
            width: calc(100vw - 40px);
            right: -10px;
          }
        }
      `}</style>
    </div>
  );
};

export default Chatbot; 