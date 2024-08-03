import { Navigate, Route, Routes } from 'react-router-dom';
import './App.css';
import Matching from './pages/Matching';
import Request from './pages/Request';
import Mypage from './pages/Mypage';
import Shop from './pages/Shop';
import { useEffect, useState } from 'react';
import { auth } from './firebase';
import Chat from './pages/Chat';
import Login from './pages/Login';

function App() {
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      setCurrentUser(currentUser);
    });

    return () => unsubscribe();
  }, []);
  
  return (
    <div className="App">
      <Routes>
        <Route path={"/"} element={currentUser ? <Navigate to={"/matching"} /> : <Login />} />
        <Route path={"/matching"} element={currentUser ? <Matching /> : <Navigate to={"/"} />} />
        <Route path={"/request"} element={currentUser ? <Request /> : <Navigate to={"/"} />} />
        <Route path={"/chat"} element={currentUser ? <Chat /> : <Navigate to={"/"} />} />
        <Route path={"/mypage"} element={currentUser ? <Mypage /> : <Navigate to={"/"} />} />
        <Route path={"/shop"} element={currentUser ? <Shop /> : <Navigate to={"/"} />} />
      </Routes>
    </div>
  );
}

export default App;
