// Simulate the webhook transcript logic with actual recording data
const recording = {
  "id": "fd5584b6a0a7455c91c8b086d56a8c98",
  "meetingId": "22baa61bb3cc5e9eb62a0377e705d613_I_681583596479192695",
  "temporaryDirectDownloadLinks": {
    "transcriptDownloadLink": "https://nta1wss.webex.com/nbr/MultiThreadDownloadServlet/transcript.txt?siteid=1194247&recordid=442133067&confid=681583596479192695&from=MBS&trackingID=ROUTERGW_ae67e992-5c40-4f9f-94ad-c2a26aad864d&language=en_US&userid=526652167&serviceRecordID=442133147&ticket=SDJTSwAAAAdIIw0roKqonGch2qZGbW8Dnevh9VnZn32n4mqUC0Q63Q%3D%3D&timestamp=1760716071085&islogin=yes&isprevent=no&ispwd=yes&siteurl=netsync.webex.com&recordingViewerInfoToken=QUhTSwAAAAfj7g74Gp6VfqZnX_1vOuXKnleOC6aZLc_mJx4uO2iHerkIxdGh00q09Fli0U_S_rdESM1uJyDyJuX1MFCZ50hXxr7OHPRNrIYfP8AxQT1T1mMVCHyO75ms5dMauSrYRBbyHKYvxSBeEKTRt_NP8CFYtWiSjRw9DC9lK1NRPWA7OxxfuwtZmDzoPKwRH2nQyf_9E5Bis4AAVOD7UBvXDZcxwbGLTEf-tru8o8H5J2uJ1vLHMLiesb4FQ-NJfJvzpT89q6Qe_dYRgj8I8UBdUoAsT-BnoKoIOmBRnrUwDhrPeKhA9L4ULwcJ1iU_AM3NHOKt2DRou4KFF3oiDAh9-kX6fkNlbXHPBKH3yqlMAtg70urn73ZuDelRHcjXIiNYM8iUG7EeRQUAk24GVkXML5-K1kqC3jCqsms4SkzYQCoHtDAKf94dwLcb1_YhSqa5sOcLzu_RnnXTlj5VnncrptYnK7M873-0zXv1vvNlHtaHmPeEX3R1jaKG-JaDbMI8qs9UQUTeaGmVYjSih3802XczEODyDrCeC0xfb4r7PLnp4g2"
  }
};

console.log('Testing webhook transcript logic...\n');

// Test the exact logic from webhook
const directTranscriptUrl = recording.temporaryDirectDownloadLinks?.transcriptDownloadLink;

console.log('Debug info:');
console.log('- hasTemporaryLinks:', !!recording.temporaryDirectDownloadLinks);
console.log('- hasTranscriptLink:', !!recording.temporaryDirectDownloadLinks?.transcriptDownloadLink);
console.log('- transcriptLinkLength:', recording.temporaryDirectDownloadLinks?.transcriptDownloadLink?.length || 0);
console.log('- directTranscriptUrl exists:', !!directTranscriptUrl);

if (directTranscriptUrl) {
    console.log('\n✅ Direct transcript URL detected - would attempt direct download');
    console.log('URL:', directTranscriptUrl.substring(0, 100) + '...');
} else {
    console.log('\n❌ Direct transcript URL NOT detected - would fall back to API');
}

// Test API fallback logic
if (!directTranscriptUrl && recording.meetingId && recording.meetingId.includes('_I_')) {
    console.log('\n✅ API fallback would be attempted with:', recording.meetingId);
} else if (!directTranscriptUrl) {
    console.log('\n❌ No API fallback available');
}