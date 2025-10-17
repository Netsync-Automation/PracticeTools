import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';

const ssmClient = new SSMClient({ region: 'us-east-1' });

async function getAccessToken() {
    try {
        const response = await ssmClient.send(new GetParameterCommand({
            Name: '/PracticeTools/dev/WEBEX_MEETINGS_ACCESS_TOKEN',
            WithDecryption: true
        }));
        return response.Parameter?.Value;
    } catch (error) {
        console.error('Error getting access token:', error.message);
        return null;
    }
}

async function testDirectTranscript() {
    const accessToken = await getAccessToken();
    if (!accessToken) {
        console.error('No access token available');
        return;
    }

    const recordingId = '965b45a3dbae43c2800363b5efcdf423';
    const directTranscriptUrl = 'https://nta1wss.webex.com/nbr/MultiThreadDownloadServlet/transcript.txt?siteid=1194247&recordid=442133067&confid=681583596479192695&from=MBS&trackingID=ROUTERGW_ae67e992-5c40-4f9f-94ad-c2a26aad864d&language=en_US&userid=526652167&serviceRecordID=442133147&ticket=SDJTSwAAAAdIIw0roKqonGch2qZGbW8Dnevh9VnZn32n4mqUC0Q63Q%3D%3D&timestamp=1760716071085&islogin=yes&isprevent=no&ispwd=yes&siteurl=netsync.webex.com&recordingViewerInfoToken=QUhTSwAAAAfj7g74Gp6VfqZnX_1vOuXKnleOC6aZLc_mJx4uO2iHerkIxdGh00q09Fli0U_S_rdESM1uJyDyJuX1MFCZ50hXxr7OHPRNrIYfP8AxQT1T1mMVCHyO75ms5dMauSrYRBbyHKYvxSBeEKTRt_NP8CFYtWiSjRw9DC9lK1NRPWA7OxxfuwtZmDzoPKwRH2nQyf_9E5Bis4AAVOD7UBvXDZcxwbGLTEf-tru8o8H5J2uJ1vLHMLiesb4FQ-NJfJvzpT89q6Qe_dYRgj8I8UBdUoAsT-BnoKoIOmBRnrUwDhrPeKhA9L4ULwcJ1iU_AM3NHOKt2DRou4KFF3oiDAh9-kX6fkNlbXHPBKH3yqlMAtg70urn73ZuDelRHcjXIiNYM8iUG7EeRQUAk24GVkXML5-K1kqC3jCqsms4SkzYQCoHtDAKf94dwLcb1_YhSqa5sOcLzu_RnnXTlj5VnncrptYnK7M873-0zXv1vvNlHtaHmPeEX3R1jaKG-JaDbMI8qs9UQUTeaGmVYjSih3802XczEODyDrCeC0xfb4r7PLnp4g2';

    console.log('Testing direct transcript download...');
    
    try {
        const response = await fetch(directTranscriptUrl);
        console.log('Status:', response.status);
        console.log('Content-Type:', response.headers.get('content-type'));
        
        if (response.ok) {
            const transcript = await response.text();
            console.log('Transcript length:', transcript.length);
            console.log('First 500 chars:', transcript.substring(0, 500));
        } else {
            const errorText = await response.text();
            console.log('Error response:', errorText.substring(0, 500));
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

testDirectTranscript();