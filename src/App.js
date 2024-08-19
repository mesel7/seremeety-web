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
import { MypageProvider } from './contexts/MypageContext';
import { MatchingProvider } from './contexts/MatchingContext';
import Setting from './pages/Setting';
import { getUserDataByUid, setNewUserData } from './utils';
import Profile from './pages/Profile';
import { RequestProvider } from './contexts/RequestContext';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isNewUserRegd, setIsNewUserRegd] = useState(false);
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      if (currentUser) {
        setCurrentUser(currentUser);

        try {
          const userData = await getUserDataByUid(currentUser.uid);
          if(!userData) {
            await setNewUserData(currentUser);
            console.log("new user regd");
          }
        } catch (error) {
          console.log(error);
        } finally {
          setIsNewUserRegd(true);
        }
      } else {
        setCurrentUser(null);
        setIsNewUserRegd(false);
      }

      setIsDataLoaded(true);
    });

    return () => unsubscribe();
  }, []);

  const appContent = (
      <div className="App">
        <Routes>
          <Route path={"/"} element={currentUser ? <Navigate to={"/matching"} /> : <Login />} />
          <Route path={"/matching"} element={currentUser ? <Matching /> : <Navigate to={"/"} />} />
          <Route path={"/profile/:uid"} element={currentUser ? <Profile /> : <Navigate to={"/"} />} />
          <Route path={"/request"} element={currentUser ? <Request /> : <Navigate to={"/"} />} />
          <Route path={"/chat"} element={currentUser ? <Chat /> : <Navigate to={"/"} />} />
          <Route path={"/mypage"} element={currentUser ? <Mypage /> : <Navigate to={"/"} />} />
          <Route path={"/shop"} element={currentUser ? <Shop /> : <Navigate to={"/"} />} />
          <Route path={"/setting"} element={currentUser ? <Setting /> : <Navigate to={"/"} />} />
        </Routes>
      </div>
  );
  
  if (!isDataLoaded) {
    return <div>데이터를 불러오는 중입니다</div>;
  } else {
    return (currentUser && isNewUserRegd) ? (
      <MatchingProvider>
        <RequestProvider>
          <MypageProvider>
            {appContent}
          </MypageProvider>
        </RequestProvider>
      </MatchingProvider>
    ) : (
      appContent
    );
  }
}

export default App;
