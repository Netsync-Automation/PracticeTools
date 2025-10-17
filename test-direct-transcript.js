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
    const directTranscriptUrl = 'https://nta1wss.webex.com/nbr/MultiThreadDownloadServlet/transcript.txt?siteid=1194247&recordid=442130132&confid=681573877425381218&from=MBS&trackingID=ROUTERGW_cba9008d-4b0a-461e-b7e6-e4ae26f90e5f&language=en_US&userid=526652167&serviceRecordID=442130297&ticket=SDJTSwAAAAd2Kc0jyEhtlFmaL70njpoQou3DxD%2FBI38m0EB0ikr5HQ%3D%3D&timestamp=1760713833879&islogin=yes&isprevent=no&ispwd=yes&siteurl=netsync.webex.com&recordingViewerInfoToken=QUhTSwAAAAe0EhXMMOp1_h1JJ1cFVdwPHXONo0xlgOKHz6fxtQedKRSSYRSndexoNqsduVRreQgZC_Eo0Kd_vi1a4-cxdCrYYFZopRaIzgcOsz4NXbRcr5LbH67kY8JUXDTj9gozG72fUl_JqX4kdsO4n1HQXoMWzQVn6DBX_zBTwMTeSEa5tVNIr6IiAezDkWjIBPVDOwAcKxdM4oIXQSGKN-c7VY0y2bscjEDZE4sx8XhFExEszHdQXdjEqMAU9HhL96Ju-itBbPitRAK2Qv_GVikIoDeixkrqYg1vLJt5uI_DkN5WCnsXNx6kfmleKcjbLXhiDAyWWgtrMU6OtPlK5VMh2Ex-Ucm0D05Sbpexb4CGBBnv0Y7j_08GpCquscWr5AWV-aN_76EBwR9uTBjCwyBMaI4SHjhFYd2IqhNKSFSKkTioOxwMn4uXJ9MCNctTb-bwF4_WQvcAT3q_WCLofAWAfR0-nU_zhpWEVi4qyKhf01A4TAQnOW8BGEKPJ6dwRc07R56DPAxkVHy_ixYFPMhS9-l5Ricxjm9LiTij46ofFmHmhA2';

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