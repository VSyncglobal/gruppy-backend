import axios from 'axios';

// Create an axios instance configured for our backend
const apiClient = axios.create({
  baseURL: 'http://localhost:3000', // The backend is running on port 3000
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;