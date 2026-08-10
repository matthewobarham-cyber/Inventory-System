import { useEffect, useRef, useState } from 'react';
import { initialsOf } from '../data.js';

export function ProfileAvatar({ account, size = 32 }) {
  const shared = { width: size, height: size, flex: 'none', borderRadius: '50%' };
  if (account?.avatar) {
    return <img src={account.avatar} alt={`${account.name} profile`} style={{ ...shared, display: 'block', objectFit: 'cover', border: '2px solid #dce5ee', background: '#eef2f6' }} />;
  }
  return <span style={{ ...shared, display: 'grid', placeItems: 'center', background: '#0a3d7c', color: '#fff', fontSize: Math.round(size * .37), fontWeight: 600, letterSpacing: '.02em' }}>{initialsOf(account?.name || '?')}</span>;
}

export function ProfilePhotoControl({ account, size = 82, onAvatarChange, onError }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const controlRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (event) => {
      if (!controlRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [menuOpen]);

  const upload = async (event) => {
    try {
      onAvatarChange(await readAvatarFile(event.target.files?.[0]));
      onError?.('');
      setMenuOpen(false);
    } catch (uploadError) {
      onError?.(uploadError.message);
    }
    event.target.value = '';
  };

  return (
    <span ref={controlRef} style={{ position: 'relative', flex: 'none', display: 'inline-flex' }}>
      <button type="button" onClick={() => setMenuOpen((open) => !open)} aria-label="Profile picture options" aria-expanded={menuOpen}
        style={{ position: 'relative', padding: 0, display: 'block', background: 'transparent', border: 0, borderRadius: '50%', cursor: 'pointer' }}>
        <ProfileAvatar account={account} size={size} />
        <span aria-hidden="true" style={{ position: 'absolute', right: -1, bottom: 1, width: Math.max(21, Math.round(size * .28)), height: Math.max(21, Math.round(size * .28)), display: 'grid', placeItems: 'center', borderRadius: '50%', background: '#0a3d7c', border: '3px solid #fff', color: '#fff', fontSize: Math.max(15, Math.round(size * .2)), fontWeight: 500, lineHeight: 1, boxShadow: '0 2px 7px rgba(13,31,51,.2)' }}>+</span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={upload} hidden />
      {menuOpen && (
        <span role="menu" style={{ position: 'absolute', zIndex: 8, top: size + 10, left: 0, minWidth: 150, padding: 5, display: 'flex', flexDirection: 'column', gap: 2, background: '#fff', border: '1px solid #dfe3e9', borderRadius: 8, boxShadow: '0 10px 28px rgba(24,39,54,.18)' }}>
          <button type="button" role="menuitem" onClick={() => inputRef.current?.click()} style={menuItemStyle}>{account?.avatar ? 'Change picture' : 'Add picture'}</button>
          {account?.avatar && <button type="button" role="menuitem" onClick={() => { onAvatarChange(''); onError?.(''); setMenuOpen(false); }} style={{ ...menuItemStyle, color: '#a01a12' }}>Delete picture</button>}
        </span>
      )}
    </span>
  );
}

const menuItemStyle = { height: 32, padding: '0 10px', background: 'transparent', border: 0, borderRadius: 6, color: '#263746', fontSize: 12, fontWeight: 500, textAlign: 'left', cursor: 'pointer' };

export async function readAvatarFile(file) {
  if (!file || !file.type.startsWith('image/')) throw new Error('Choose a valid image file.');
  if (file.size > 12 * 1024 * 1024) throw new Error('Choose an image smaller than 12 MB.');
  const source = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('The image could not be read.'));
    reader.readAsDataURL(file);
  });
  const image = await new Promise((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error('The image could not be opened.'));
    next.src = source;
  });
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  const canvas = document.createElement('canvas');
  canvas.width = 320;
  canvas.height = 320;
  const context = canvas.getContext('2d');
  context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, 320, 320);
  return canvas.toDataURL('image/jpeg', .86);
}
