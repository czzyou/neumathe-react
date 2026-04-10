import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';

interface LoginModalProps {
  onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (isLogin) {
        const res = await axios.post('/api/login', { username, password });
        login(res.data.token, res.data.user);
        onClose();
      } else {
        await axios.post('/api/register', { username, password });
        setIsLogin(true);
        setError('注册成功，请登录');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || '操作失败，请稍后重试');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{isLogin ? '用户登录' : '用户注册'}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="error-message">{error}</div>}
          <div className="form-group">
            <label>用户名</label>
            <input 
              type="text" 
              value={username} 
              onChange={e => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input 
              type="password" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
              required 
            />
          </div>
          <button type="submit" className="submit-btn">
            {isLogin ? '登录' : '注册'}
          </button>
        </form>
        <div className="modal-footer">
          <button className="toggle-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? '没有账号？去注册' : '已有账号？去登录'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LoginModal;
