export const state = {
    contextHistory: [],
    isDebating: false,
    debateRound: 0,
    globalFileContent: "",
    isFileEnabled: false
};

export function resetState() {
    state.contextHistory = [];
    state.debateRound = 0;
}