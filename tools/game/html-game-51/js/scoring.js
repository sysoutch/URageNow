function findGroups(dice) {

    const groups = [];

    if (!dice || dice.length === 0) {
        return groups;
    }


    const counts = {};

    dice.forEach(v => {
        counts[v] = (counts[v] || 0) + 1;
    });


    // singles
    dice.forEach((v, i) => {

        if (v === 1 || v === 5) {
            groups.push([i]);
        }

    });


    // triples or more
    Object.keys(counts).forEach(number => {

        if (counts[number] >= 3) {

            const group = [];

            dice.forEach((v, i) => {

                if (v == number) {
                    group.push(i);
                }

            });


            groups.push(group);

        }

    });


    return groups;

}



function getScore(values) {

    if (!values || values.length === 0)
        return 0;


    let score = 0;


    const counts = {};


    values.forEach(v => {

        counts[v] = (counts[v] || 0) + 1;

    });



    // triples first
    Object.keys(counts).forEach(v => {

        let amount = counts[v];

        let number = Number(v);


        if (amount >= 3) {


            if (number === 1) {

                score += 1000;

            }
            else {

                score += number * 100;

            }


            // extra dice - for 1s, each additional die adds the triple value (1000)
            // for other numbers, each additional die adds number*100 (or doubles in double mode)
            if(amount > 3){

                for(let i=3;i<amount;i++){

                    if(Rules.kindMode === "double")
                        score *= 2;

                    else if(number === 1)
                        score += 1000;  // Each additional 1 adds 1000 points

                    else
                        score += number * 100;

                }

            }


        }

    });



    // remaining single 1/5
    Object.keys(counts).forEach(v=>{

        let number=Number(v);

        let amount=counts[v];


        if(number===1 && amount<3){

            score += amount*100;

        }


        if(number===5 && amount<3){

            score += amount*50;

        }


    });


    return score;

}



function hasPossibleScore(dice) {

    return findGroups(dice).length > 0;

}

function hasStraight(dice){

    if(!dice || dice.length !== 6)
        return false;


    const sorted = [...dice].sort();


    return (
        sorted[0] === 1 &&
        sorted[1] === 2 &&
        sorted[2] === 3 &&
        sorted[3] === 4 &&
        sorted[4] === 5 &&
        sorted[5] === 6
    );

}