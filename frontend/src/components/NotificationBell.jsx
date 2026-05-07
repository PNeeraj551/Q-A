import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { io } from 'socket.io-client'
import { SOCKET_URL } from '../api/socketUrl'
import { getNotifications, markAsRead, markAllAsRead } from '../api/notifications'

/**
 * NotificationBell Component
 * 
 * Provides a real-time notification center for session reminders and invites.
 * Uses Socket.IO for instant updates and follows Shadcn/UI design principles.
 */
export default function NotificationBell() {
  const navigate = useNavigate()
  const dropdownRef = useRef(null)
  
  const [notifications, setNotifications] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Memoized unread count for performance
  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.is_read).length, 
    [notifications]
  )

  /**
   * Fetches initial notification state from the API
   */
  const fetchNotifications = useCallback(async () => {
    setIsLoading(true)
    try {
      const { data } = await getNotifications()
      setNotifications(data.notifications || [])
    } catch (err) {
      console.error('[NotificationBell] Fetch error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  /**
   * Real-time socket integration
   */
  useEffect(() => {
    const token = localStorage.getItem('jwt')
    if (!token) return

    fetchNotifications()

    const socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: { token }
    })

    socket.on('notification:new', (notif) => {
      setNotifications(prev => [notif, ...prev])
    })

    socket.connect()
    return () => socket.disconnect()
  }, [fetchNotifications])

  /**
   * Click outside listener for dropdown closure
   */
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleToggle = () => setIsOpen(prev => !prev)

  const handleMarkRead = async (id) => {
    try {
      await markAsRead(id)
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, is_read: true } : n))
    } catch (err) {
      console.error('[NotificationBell] Mark read error:', err)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead()
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
    } catch (err) {
      console.error('[NotificationBell] Mark all read error:', err)
    }
  }

  const handleNotificationClick = (notification) => {
    if (!notification.is_read) handleMarkRead(notification._id)
    if (notification.session_id) {
      setIsOpen(false)
      navigate('/participant/sessions')
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <BellButton 
        onClick={handleToggle} 
        unreadCount={unreadCount} 
      />

      {isOpen && (
        <NotificationDropdown 
          notifications={notifications}
          loading={isLoading}
          unreadCount={unreadCount}
          onMarkAllRead={handleMarkAllRead}
          onItemClick={handleNotificationClick}
        />
      )}
    </div>
  )
}

/**
 * Sub-component: BellButton
 */
function BellButton({ onClick, unreadCount }) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-xl hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/20"
      aria-label="Toggle notifications"
    >
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
      {unreadCount > 0 && (
        <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background px-1">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  )
}

/**
 * Sub-component: NotificationDropdown
 */
function NotificationDropdown({ notifications, loading, unreadCount, onMarkAllRead, onItemClick }) {
  return (
    <div className="absolute right-0 mt-2 w-80 bg-card rounded-2xl shadow-xl border border-border overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
        <h3 className="text-sm font-bold text-foreground">Notifications</h3>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto divide-y divide-border">
        {loading && notifications.length === 0 ? (
          <EmptyState loading />
        ) : notifications.length === 0 ? (
          <EmptyState />
        ) : (
          notifications.map(n => (
            <NotificationItem 
              key={n._id} 
              notification={n} 
              onClick={() => onItemClick(n)} 
            />
          ))
        )}
      </div>
    </div>
  )
}

/**
 * Sub-component: NotificationItem
 */
function NotificationItem({ notification: n, onClick }) {
  const isReminder = n.type === 'REMINDER'
  const timeStr = new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const dateStr = new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })

  return (
    <div
      className={`p-4 hover:bg-muted/50 cursor-pointer transition-colors relative group ${!n.is_read ? 'bg-primary/[0.03]' : ''}`}
      onClick={onClick}
    >
      <div className="flex gap-3">
        <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center ${isReminder ? 'bg-amber-100 text-amber-600' : 'bg-indigo-100 text-indigo-600'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d={isReminder ? "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" : "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-xs leading-relaxed ${!n.is_read ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
            {n.message}
          </p>
          <div className="text-[10px] text-muted-foreground mt-1.5 flex items-center gap-1 opacity-70">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 6v6l4 2" />
            </svg>
            <span>{dateStr} at {timeStr}</span>
          </div>
        </div>
        {!n.is_read && (
          <div className="w-2 h-2 rounded-full bg-primary mt-1 shrink-0 shadow-sm shadow-primary/20" />
        )}
      </div>
    </div>
  )
}

/**
 * Sub-component: EmptyState
 */
function EmptyState({ loading }) {
  if (loading) return (
    <div className="p-12 text-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
      <p className="text-xs text-muted-foreground animate-pulse">Syncing notifications...</p>
    </div>
  )

  return (
    <div className="p-12 text-center">
      <div className="w-12 h-12 bg-muted rounded-2xl flex items-center justify-center mx-auto mb-4 opacity-40">
        <svg className="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
      </div>
      <p className="text-sm font-semibold text-foreground">All caught up!</p>
      <p className="text-xs text-muted-foreground mt-1 max-w-[180px] mx-auto">We'll notify you here about upcoming sessions and invites.</p>
    </div>
  )
}
