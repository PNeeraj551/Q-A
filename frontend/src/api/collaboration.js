import axiosInstance from './axiosInstance'

export const createGroup = (sessionId, groupName, participantIds) =>
  axiosInstance.post('/collaboration/groups', {
    session_id: sessionId,
    group_name: groupName,
    participant_ids: participantIds,
  })

export const getMyGroups = (sessionId) =>
  axiosInstance.get(`/collaboration/groups/session/${sessionId}`)

export const getMessages = (groupId) =>
  axiosInstance.get(`/collaboration/groups/${groupId}/messages`)

export const sendMessage = (groupId, message_text) =>
  axiosInstance.post(`/collaboration/groups/${groupId}/messages`, { message_text })

export const leaveGroup = (groupId) =>
  axiosInstance.post(`/collaboration/groups/${groupId}/leave`)

export const submitQuestion = (groupId, question_text) =>
  axiosInstance.post(`/collaboration/groups/${groupId}/submit-question`, { question_text })
