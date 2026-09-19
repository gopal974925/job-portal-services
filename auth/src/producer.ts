import { Kafka, Producer, Admin } from "kafkajs";
import dotenv from "dotenv";

let producer: Producer;
let admin: Admin;

export const connnectKafka = async () => {
  try {
    const kafka = new Kafka({
      clientId: "Auth-service",
      brokers: [process.env.KAFKA_BROKERS || "localhost:9092"],
    });

    admin = kafka.admin();
    await admin.connect();
    const topic = await admin.listTopics();

    if (!topic.includes("send-mail")) {
      try {
        await admin.createTopics({
        topics: [
          {
            topic: "send-mail",
            numPartitions: 1,
            replicationFactor: 1,
          },
        ],
      });
      console.log("Sent mail created");
      } catch (error) {
      console.log("Something went wrong")
      }
    }


    await admin.disconnect();
    producer = kafka.producer();
    await producer.connect();
    console.log("Connected to kafka producer");
  } catch (error) {
    console.log("Not conecting to kafka");
  }
};


export const publishtopic=async(topic:string,message:any) =>{
    if(!producer){
        console.log("kafka is not implemented");
        return;
    }   
    try {
        await producer.send({
            topic:topic,
            messages:[{
                value:JSON.stringify(message),

            },],

        });
    } catch (error) {
            console.log("Faild to publish");
            
    }
}


export const kafkadiscconncet=async()=>{
    if(producer){
        producer.disconnect()
    }
}